import React, { useState } from 'react';
import { Plus, Edit2, AlertCircle, X, Trash2, Ban, History, Archive, RefreshCcw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

import { computeStockProjection } from '../services/inventory.service';
import { createPurchaseEvent } from '../services/purchase.service';
import { Unit, BaseUnit } from '../domain/types';
import { PurchaseInput } from '../domain/purchase';
import { formatQuantityForDisplay, formatCostForDisplay, formatNumber } from '../domain/units';
import { useConnectivity } from '../hooks/useConnectivity';

export const InventoryPage: React.FC = () => {
  const inventoryEvents = useAppStore(state => state.inventoryEvents);
  const inventorySnapshots = useAppStore(state => state.inventorySnapshots);
  const addInventoryEvent = useAppStore(state => state.addInventoryEvent);
  const setInventorySnapshots = useAppStore(state => state.setInventorySnapshots);
  const catalog = useAppStore(state => state.catalog);
  const dishes = useAppStore(state => state.dishes);
  const { isOnline } = useConnectivity();

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseIngredient, setPurchaseIngredient] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState<Unit>('kg');
  const [purchaseTotalCost, setPurchaseTotalCost] = useState('');

  const [editingStock, setEditingStock] = useState<{name: string, qty: number, unit: BaseUnit, cost: number} | null>(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [newStockCost, setNewStockCost] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const [activeTab, setActiveTab] = useState<'current' | 'archived'>('current');
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [reactivateOnPurchase, setReactivateOnPurchase] = useState(true);
  const deactivateCatalogItem = useAppStore(state => state.deactivateCatalogItem);
  const activateCatalogItem = useAppStore(state => state.activateCatalogItem);


  const handleRebuildInventory = () => {
    setInventorySnapshots([]);
    alert('Inventario reconstruido desde el Registro Contable de eventos.');
  };

  const handleRegisterPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseIngredient || !purchaseQty || !purchaseTotalCost) return;

    try {
      const input: PurchaseInput = {
        ingredientId: purchaseIngredient,
        quantity: parseFloat(purchaseQty),
        unit: purchaseUnit,
        totalCost: parseFloat(purchaseTotalCost)
      };
      
      const event = createPurchaseEvent(input, catalog);
      addInventoryEvent(event);

      const selectedCat = catalog.find(c => c.id === purchaseIngredient);
      if (selectedCat && !selectedCat.active && reactivateOnPurchase) {
        activateCatalogItem(purchaseIngredient);
      }


      setShowPurchaseForm(false);
      setPurchaseIngredient('');
      setPurchaseQty('');
      setPurchaseUnit('kg');
      setPurchaseTotalCost('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al registrar la compra');
    }
  };

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStock || !newStockQty || !newStockCost || !adjustmentReason) return;

    const newQty = parseFloat(newStockQty);
    const diffQty = newQty - editingStock.qty;
    const newCost = parseFloat(newStockCost);
    const diffCost = newCost - editingStock.cost;

    if (diffQty === 0 && diffCost === 0) {
      setEditingStock(null);
      return;
    }

    const event = {
      id: `ev_adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'ADJUSTMENT',
      ingredientId: editingStock.name,
      quantity: diffQty,
      unit: editingStock.unit,
      costPerUnit: newCost > 0 ? newCost : editingStock.cost,
      timestamp: new Date().toISOString(),
      source: 'MANUAL_ADJUSTMENT',
      causality: adjustmentReason
    } as any;

    addInventoryEvent(event);
    setEditingStock(null);
    setNewStockQty('');
    setNewStockCost('');
    setAdjustmentReason('');
  };

  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);
  
  const activeItems = catalog.filter(c => c.active);
  const archivedItems = catalog.filter(c => !c.active);

  // For current stock, we also want to show items that have stock but were deactivated (edge case)
  // But per user request, we usually hide them unless we are in the archived view.
  const visibleItems = activeTab === 'current' 
    ? activeItems.map(item => ({ item, stock: stockProjection[item.id] || { quantity: 0, unit: item.defaultUnit, cost: item.baseCost } }))
    : archivedItems.map(item => ({ item, stock: stockProjection[item.id] || { quantity: 0, unit: item.defaultUnit, cost: item.baseCost } }));

  const dishesAffectedBy = (catalogId: string) => {
    return dishes.filter(d => d.ingredients.some(ing => ing.catalogId === catalogId));
  };

  const handleDeactivate = async () => {
    if (!deactivatingId) return;
    setIsDeactivating(true);
    try {
      await deactivateCatalogItem(deactivatingId);
      setDeactivatingId(null);
    } catch (error) {
      alert('Error al desactivar: ' + error);
    } finally {
      setIsDeactivating(false);
    }
  };


  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Inventario Proyectado</h2>
          <p className="text-slate-500 mt-1">Stock calculado desde el Ledger (Inmutable).</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowPurchaseForm(true)}
            disabled={!isOnline}
            className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-3 border-b-2 border-[#0e7490]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Entrada de Compra
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <div className="text-amber-600 mt-0.5"><AlertCircle size={18} /></div>
          <div>
            <h4 className="font-bold text-amber-800 text-sm">Escritura Bloqueada (Offline)</h4>
            <p className="text-xs text-amber-700 mt-1">
              Debes estar online para registrar compras o ajustar stock y asegurar la consistencia del inventario.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${activeTab === 'current' ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <History size={18} />
          Stock Activo
        </button>
        <button 
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${activeTab === 'archived' ? 'border-[#06b6d4] text-[#06b6d4]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Archive size={18} />
          Archivo (Obsoletos)
        </button>
      </div>


      {/* Desktop Table */}
      <div className="hidden md:block card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-medium">Ingrediente</th>
                <th className="p-4 font-medium">Stock Actual</th>
                <th className="p-4 font-medium">Unidad</th>
                <th className="p-4 font-medium">Último Coste</th>
                <th className="p-4 font-medium">Valor Total</th>
                <th className="p-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map(({ item, stock: data }) => {
                const displayQty = formatQuantityForDisplay(data.quantity, data.unit as BaseUnit);
                const displayCost = formatCostForDisplay(data.cost, data.unit as BaseUnit);
                return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">{item.id}</div>
                  </td>
                  <td className={`p-4 ${data.quantity < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                    <div className="font-bold text-base">{formatNumber(displayQty.value)}</div>
                    {displayQty.unit !== displayQty.baseUnit && (
                      <div className="text-xs text-slate-400">({formatNumber(displayQty.baseValue)} {displayQty.baseUnit})</div>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">{displayQty.unit}</td>
                  <td className="p-4">
                    <div className="font-medium text-slate-700">{formatNumber(displayCost.value, 4)} €/{displayCost.unit}</div>
                    {displayCost.unit !== displayCost.baseUnit && (
                      <div className="text-xs text-slate-400">({formatNumber(displayCost.baseValue, 6)} €/{displayCost.baseUnit})</div>
                    )}
                  </td>
                  <td className="p-4 font-medium text-slate-800">
                    {formatNumber(data.quantity * data.cost)} €
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          if (!isOnline) return;
                          setEditingStock({name: item.id, qty: data.quantity, unit: data.unit as BaseUnit, cost: data.cost});
                          setNewStockCost(data.cost.toString());
                        }}
                        disabled={!isOnline}
                        className="text-[#06b6d4] hover:bg-[#06b6d4]/10 p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isOnline ? "Ajustar Stock" : "Bloqueado en Offline"}
                      >
                        <Edit2 size={18} />
                      </button>
                      {item.active ? (
                        <button 
                          onClick={() => setDeactivatingId(item.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all"
                          title="Desactivar / Obsoleto"
                        >
                          <Ban size={18} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => activateCatalogItem(item.id)}
                          className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-all"
                          title="Restaurar / Activar"
                        >
                          <RefreshCcw size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Archive size={40} className="opacity-20 mb-2" />
                      <p>No hay productos en esta vista.</p>
                    </div>
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {visibleItems.map(({ item, stock: data }) => {
          const displayQty = formatQuantityForDisplay(data.quantity, data.unit as BaseUnit);
          const displayCost = formatCostForDisplay(data.cost, data.unit as BaseUnit);
          return (
            <div key={item.id} className="card-base p-5 flex flex-col gap-3 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                    <span>{formatNumber(displayCost.value, 4)} €/{displayCost.unit}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="font-medium text-slate-700">Total: {formatNumber(data.quantity * data.cost)} €</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (!isOnline) return;
                      setEditingStock({name: item.id, qty: data.quantity, unit: data.unit as BaseUnit, cost: data.cost});
                      setNewStockCost(data.cost.toString());
                    }}
                    disabled={!isOnline}
                    className="text-[#06b6d4] bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 active:scale-95 transition-transform p-3 rounded-lg flex items-center justify-center disabled:opacity-30"
                  >
                    <Edit2 size={20} />
                  </button>
                  {item.active ? (
                    <button 
                      onClick={() => setDeactivatingId(item.id)}
                      className="text-red-400 bg-red-50 hover:bg-red-100 active:scale-95 transition-transform p-3 rounded-lg flex items-center justify-center"
                      title="Desactivar / Obsoleto"
                    >
                      <Ban size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => activateCatalogItem(item.id)}
                      className="text-emerald-500 bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-transform p-3 rounded-lg flex items-center justify-center"
                      title="Restaurar / Activar"
                    >
                      <RefreshCcw size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-100">
                <span className="text-sm text-slate-500 font-medium">Stock Actual</span>
                <div className={`text-right ${data.quantity < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                  <span className="font-bold text-xl">{formatNumber(displayQty.value)}</span>
                  <span className="text-sm ml-1">{displayQty.unit}</span>
                </div>
              </div>
            </div>
          );
        })}
        {visibleItems.length === 0 && (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center text-slate-400">
             <Archive size={40} className="mx-auto opacity-20 mb-2" />
             <p>No hay productos en esta vista.</p>
          </div>
        )}
      </div>


      {/* Bottom Sheet: Registrar Compra */}
      {showPurchaseForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 transition-opacity">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-serif font-bold text-xl text-slate-800">Registrar Compra</h3>
              <button 
                onClick={() => setShowPurchaseForm(false)}
                className="text-slate-400 hover:text-slate-600 p-2 -mr-2 active:scale-95 transition-transform"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <form onSubmit={handleRegisterPurchase} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Ingrediente</label>
                  <select 
                    className="input-base bg-white"
                    value={purchaseIngredient}
                    onChange={(e) => setPurchaseIngredient(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {[...catalog].sort((a,b) => Number(b.active) - Number(a.active)).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name} {!cat.active ? '(Obsoleto)' : ''}</option>
                    ))}

                  </select>
                </div>
                
                {(() => {
                  const sel = catalog.find(c => c.id === purchaseIngredient);
                  if (sel && !sel.active) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-sm">
                        <h4 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
                          <AlertCircle size={18} className="text-amber-600" /> Ingrediente archivado
                        </h4>
                        <label className="flex items-start gap-3 text-sm text-amber-900 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 mt-0.5 text-[#06b6d4] focus:ring-[#06b6d4] rounded"
                            checked={reactivateOnPurchase}
                            onChange={(e) => setReactivateOnPurchase(e.target.checked)}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">Reactivar automáticamente</span>
                            <span className="text-xs text-amber-700/80 mt-0.5">Al guardar la compra, el insumo volverá a estar disponible para la elaboración de producciones.</span>
                          </div>
                        </label>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad</label>
                    <input 
                      type="number" inputMode="decimal" 
                      min="0" 
                      step="any" 
                      required
                      className="input-base"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Unidad</label>
                    <select 
                      className="input-base bg-white"
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value as Unit)}
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="ud">ud</option>
                    </select>
                  </div>
                </div>

                {/* Quick Incrementors for Quantity */}
                <div className="flex gap-2">
                  {[1, 5, 10, 25].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPurchaseQty(prev => ((parseFloat(prev) || 0) + val).toString())}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Coste Total (€)</label>
                  <input 
                    type="number" inputMode="decimal" 
                    min="0" 
                    step="any" 
                    required
                    className="input-base"
                    value={purchaseTotalCost}
                    onChange={(e) => setPurchaseTotalCost(e.target.value)}
                  />
                </div>
                
                <div className="mt-4">
                  <button 
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 active:bg-slate-900 text-white font-semibold rounded-xl px-5 py-4 transition-all shadow-lg text-lg"
                  >
                    Guardar Compra
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet: Ajustar Inventario */}
      {editingStock && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 transition-opacity">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-serif font-bold text-xl text-slate-800">Ajustar Inventario</h3>
              <button 
                onClick={() => setEditingStock(null)}
                className="text-slate-400 hover:text-slate-600 p-2 -mr-2 active:scale-95 transition-transform"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-lg mb-1">{editingStock.name}</h4>
                <p className="text-sm text-slate-500">Cantidad actual en base: <span className="font-bold text-slate-700">{editingStock.qty.toFixed(2)} {editingStock.unit}</span></p>
              </div>

              <form onSubmit={handleAdjustStock} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Nueva Cantidad Real ({editingStock.unit})</label>
                  <input 
                    type="number" inputMode="decimal" step="any" required
                    className="input-base"
                    placeholder="Ej. 1500"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(e.target.value)}
                  />
                  <div className="flex gap-2 mt-3">
                    {[ -100, -10, 10, 100 ].map(step => (
                      <button 
                        key={step} type="button"
                        onClick={() => {
                          const current = parseFloat(newStockQty) || editingStock.qty;
                          setNewStockQty(Math.max(0, current + step).toString());
                        }}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${step > 0 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                      >
                        {step > 0 ? '+' : ''}{step}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Nuevo Coste U. (€/{editingStock.unit})</label>
                  <input 
                    type="number" inputMode="decimal" step="any" min="0" required
                    className="input-base"
                    placeholder="Ej. 24.50"
                    value={newStockCost}
                    onChange={(e) => setNewStockCost(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Motivo del ajuste</label>
                  <select 
                    className="input-base bg-white"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar motivo...</option>
                    <option value="Merma/Caducidad">Merma / Caducidad</option>
                    <option value="Rotura/Accidente">Rotura / Accidente</option>
                    <option value="Error de inventario previo">Error de inventario previo</option>
                    <option value="Consumo personal/invitación">Consumo personal / Invitación</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                
                <div className="mt-4">
                  <button 
                    type="submit"
                    className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={20} />
                    Confirmar Ajuste
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Desactivación */}
      {deactivatingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">¿Desactivar Ingrediente?</h3>
              <p className="text-slate-500 text-center mb-6">
                Este ingrediente dejará de estar disponible para compras y producción. <br/>
                <span className="font-medium text-slate-700">El historial contable se conservará intacto.</span>
              </p>

              {dishesAffectedBy(deactivatingId).length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
                  <h4 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
                    <Trash2 size={14} />
                    Escandallos afectados:
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    {dishesAffectedBy(deactivatingId).map(d => (
                      <li key={d.id}>{d.name}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-600 mt-2 italic">
                    * Estos escandallos quedarán marcados como 'OBSOLETOS'.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-3 rounded-xl font-medium transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isDeactivating ? 'Desactivando...' : 'Confirmar Desactivación'}
                </button>
                <button 
                  onClick={() => setDeactivatingId(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};
