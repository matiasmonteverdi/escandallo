import React, { useState } from 'react';
import { Plus, Edit2, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeStockProjection } from '../services/inventory.service';
import { createPurchaseEvent } from '../services/purchase.service';
import { Unit, BaseUnit } from '../domain/types';
import { PurchaseInput } from '../domain/purchase';
import { formatQuantityForDisplay, formatCostForDisplay, formatNumber } from '../domain/units';

export const InventoryPage: React.FC = () => {
  const inventoryEvents = useAppStore(state => state.inventoryEvents);
  const inventorySnapshots = useAppStore(state => state.inventorySnapshots);
  const addInventoryEvent = useAppStore(state => state.addInventoryEvent);
  const setInventorySnapshots = useAppStore(state => state.setInventorySnapshots);
  const catalog = useAppStore(state => state.catalog);
  const dishes = useAppStore(state => state.dishes);

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseIngredient, setPurchaseIngredient] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState<Unit>('kg');
  const [purchaseTotalCost, setPurchaseTotalCost] = useState('');

  const [editingStock, setEditingStock] = useState<{name: string, qty: number, unit: BaseUnit, cost: number} | null>(null);
  const [newStockQty, setNewStockQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

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
      
      const event = createPurchaseEvent(input);
      addInventoryEvent(event);

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
    if (!editingStock || !newStockQty || !adjustmentReason) return;

    const newQty = parseFloat(newStockQty);
    const diff = newQty - editingStock.qty;

    if (diff === 0) {
      setEditingStock(null);
      return;
    }

    const event = {
      id: `ev_adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: diff > 0 ? 'PURCHASE' : 'CONSUMPTION',
      ingredientId: editingStock.name,
      quantity: Math.abs(diff),
      unit: editingStock.unit,
      costPerUnit: editingStock.cost,
      timestamp: new Date().toISOString(),
      source: 'MANUAL_ADJUSTMENT',
      causality: adjustmentReason
    } as any;

    addInventoryEvent(event);
    setEditingStock(null);
    setNewStockQty('');
    setAdjustmentReason('');
  };

  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);
  const visibleStock = Object.entries(stockProjection).filter(([_, data]) => Math.abs(data.quantity) > 0.001);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Inventario (Proyección)</h2>
          <p className="text-slate-500 mt-1">Stock calculado en tiempo real basado en el Registro Contable.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleRebuildInventory}
            className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-slate-300 text-slate-700 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-3"
          >
            Reconstruir
          </button>
          <button 
            onClick={() => setShowPurchaseForm(true)}
            className="flex-1 md:flex-none bg-[#06b6d4] hover:bg-[#0891b2] active:scale-95 active:bg-[#0e7490] text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-3 shadow-md"
          >
            <Plus size={18} />
            Entrada
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
              {visibleStock.map(([catId, data]) => {
                const displayQty = formatQuantityForDisplay(data.quantity, data.unit as BaseUnit);
                const displayCost = formatCostForDisplay(data.cost, data.unit as BaseUnit);
                const catItem = catalog.find(c => c.id === catId);
                const displayName = catItem?.name || catId;
                return (
                <tr key={catId} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{displayName}</td>
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
                    <button 
                      onClick={() => setEditingStock({name: catId, qty: data.quantity, unit: data.unit as BaseUnit, cost: data.cost})}
                      className="text-[#06b6d4] hover:text-[#0891b2] active:scale-95 transition-transform p-2 -ml-2 rounded-lg hover:bg-[#06b6d4]/10"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              )})}
              {visibleStock.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No hay inventario registrado. Registra una compra para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {visibleStock.map(([catId, data]) => {
          const displayQty = formatQuantityForDisplay(data.quantity, data.unit as BaseUnit);
          const displayCost = formatCostForDisplay(data.cost, data.unit as BaseUnit);
          const catItem = catalog.find(c => c.id === catId);
          const displayName = catItem?.name || catId;
          return (
            <div key={catId} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 relative">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{displayName}</h3>
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                    <span>{formatNumber(displayCost.value, 4)} €/{displayCost.unit}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="font-medium text-slate-700">Total: {formatNumber(data.quantity * data.cost)} €</span>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingStock({name: catId, qty: data.quantity, unit: data.unit as BaseUnit, cost: data.cost})}
                  className="text-[#06b6d4] bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 active:scale-95 transition-transform p-3 rounded-lg flex items-center justify-center"
                >
                  <Edit2 size={20} />
                </button>
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
        {visibleStock.length === 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            No hay inventario registrado. Registra una compra para empezar.
          </div>
        )}
      </div>

      {/* Bottom Sheet: Registrar Compra */}
      {showPurchaseForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 transition-opacity">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent bg-white"
                    value={purchaseIngredient}
                    onChange={(e) => setPurchaseIngredient(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {catalog.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Cantidad</label>
                    <input 
                      type="number" inputMode="decimal" 
                      min="0" 
                      step="any" 
                      required
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Unidad</label>
                    <select 
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent bg-white"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                    value={purchaseTotalCost}
                    onChange={(e) => setPurchaseTotalCost(e.target.value)}
                  />
                </div>
                
                <div className="mt-4">
                  <button 
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 active:bg-slate-900 text-white py-4 rounded-xl font-medium transition-all shadow-lg text-lg"
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
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
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
                    type="number" inputMode="decimal" 
                    min="0" 
                    step="any" 
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent text-lg font-bold"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(e.target.value)}
                    placeholder="Ej. 1500"
                  />
                </div>

                {/* Quick Incrementors/Decrementors */}
                <div className="grid grid-cols-4 gap-2">
                  {[-100, -10, 10, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(newStockQty) || editingStock.qty;
                        const next = Math.max(0, current + val);
                        setNewStockQty(next.toString());
                      }}
                      className={`py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${val > 0 ? 'bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200' : 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200'}`}
                    >
                      {val > 0 ? '+' : ''}{val}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Motivo del ajuste</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent bg-white"
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
                    className="w-full bg-[#06b6d4] hover:bg-[#0891b2] active:scale-95 active:bg-[#0e7490] text-white py-4 rounded-xl font-medium transition-all shadow-lg text-lg flex items-center justify-center gap-2"
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
    </div>
  );
};
