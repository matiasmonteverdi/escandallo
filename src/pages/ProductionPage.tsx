import React, { useState } from 'react';
import { Plus, Edit2, AlertCircle, X, Check, Ban } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { generateProductionResult, validateRecipeAvailability } from '../services/production.service';
import { computeStockProjection } from '../services/inventory.service';
import { Production } from '../data';
import { calculateDishCost } from '../App';
import { ProductionMode } from '../domain/types';
import { useConnectivity } from '../hooks/useConnectivity';

export const ProductionPage: React.FC = () => {
  const dishes = useAppStore(state => state.dishes);
  const productions = useAppStore(state => state.productions);
  const addProduction = useAppStore(state => state.addProduction);
  const catalog = useAppStore(state => state.catalog);
  const inventoryEvents = useAppStore(state => state.inventoryEvents);
  const addInventoryEvent = useAppStore(state => state.addInventoryEvent);
  const inventorySnapshots = useAppStore(state => state.inventorySnapshots);
  const { isOnline } = useConnectivity();

  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);
  const stockProjectionByQty = React.useMemo(
    () => Object.fromEntries(Object.entries(stockProjection).map(([id, data]) => [id, data.quantity])),
    [stockProjection]
  );

  const [prodDishId, setProdDishId] = useState('');
  const [prodRealQty, setProdRealQty] = useState('');
  const [prodNotes, setProdNotes] = useState('');
  const [prodVariantSelection, setProdVariantSelection] = useState<Record<string, number>>({});
  const [prodError, setProdError] = useState<string | null>(null);
  const [productionMode, setProductionMode] = useState<ProductionMode>('real');

  const [showProductionForm, setShowProductionForm] = useState(false);

  const selectedDishForProd = dishes.find(d => d.id === prodDishId);

  const preFlight = React.useMemo(() => {
    if (!selectedDishForProd) return null;
    const qty = parseFloat(prodRealQty) || selectedDishForProd.portions;
    return validateRecipeAvailability(
      selectedDishForProd,
      qty,
      dishes,
      catalog,
      stockProjectionByQty,
      prodVariantSelection,
      productionMode
    );
  }, [selectedDishForProd, prodRealQty, dishes, catalog, stockProjectionByQty, prodVariantSelection, productionMode]);

  const handleRegisterProduction = (e: React.FormEvent) => {
    e.preventDefault();
    setProdError(null);
    if (!prodDishId || !prodRealQty) return;

    const dish = dishes.find(d => d.id === prodDishId);
    if (!dish) return;

    const producedQty = parseFloat(prodRealQty);
    const newProdId = Date.now().toString();

    const newProd: Production = {
      id: newProdId,
      recipeId: prodDishId,
      date: new Date().toISOString(),
      expectedQuantity: dish.portions,
      quantityProduced: producedQty,
      notes: prodNotes,
      variantSelection: prodVariantSelection,
      mode: productionMode
    };

    const idempotencyKey = `prod_${newProdId}`;

    if (inventoryEvents.some(ev => ev.idempotencyKey === idempotencyKey)) {
      console.warn('Duplicate production event detected. Ignoring.');
      return;
    }
    
    if (preFlight && !preFlight.canProduce) {
      setProdError('No se puede producir. Por favor resuelve los errores de ingredientes inactivos listados abajo.');
      return;
    }

    try {
      const productionResult = generateProductionResult(newProd, dish, dishes, catalog);
      productionResult.events.forEach(ev => addInventoryEvent(ev));
      addProduction(newProd);
      
      setProdDishId('');
      setProdRealQty('');
      setProdNotes('');
      setProdVariantSelection({});
      setProductionMode('real');
      setProdError(null);
      setShowProductionForm(false);
    } catch (err: any) {
      setProdError(err.message || 'Error al generar consumo.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Producción</h2>
          <p className="text-slate-500 mt-1">Registra lo que cocinas y compara el coste teórico con el real.</p>
        </div>
        <button 
          onClick={() => setShowProductionForm(true)}
          disabled={!isOnline}
          className="w-full md:w-auto btn-primary flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Nueva Producción
        </button>
      </div>

      {!isOnline && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <div className="text-amber-600 mt-0.5"><AlertCircle size={18} /></div>
          <div>
            <h4 className="font-bold text-amber-800 text-sm">Escritura Bloqueada (Offline)</h4>
            <p className="text-xs text-amber-700 mt-1">
              Debes estar online para registrar nuevas producciones y asegurar la consistencia del inventario.
            </p>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Receta</th>
                <th className="p-4 font-medium text-center">Raciones</th>
                <th className="p-4 font-medium text-right">Coste Teórico</th>
                <th className="p-4 font-medium text-right">Coste Real</th>
                <th className="p-4 font-medium text-center">Desviación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productions.map(prod => {
                const dish = dishes.find(d => d.id === prod.recipeId);
                if (!dish) return null;

                const { totalCost } = calculateDishCost(dish, prod.variantSelection, stockProjection);
                const theoreticalCostPerPortion = totalCost / dish.portions;
                const realCostPerPortion = totalCost / prod.quantityProduced;
                
                const deviation = ((realCostPerPortion - theoreticalCostPerPortion) / theoreticalCostPerPortion) * 100;
                const isGood = deviation <= 0;
                const isBad = deviation > 5;

                return (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500 text-sm">
                      {new Date(prod.date).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{dish.name}</div>
                      {dish.hasInactiveIngredients && (
                        <div className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase w-fit mt-1">
                          <Ban size={10} />
                          Obsoleto
                        </div>
                      )}
                      {prod.mode === 'theoretical' && (
                        <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold uppercase w-fit mt-1">
                          🧪 Simulación
                        </div>
                      )}
                      {prod.notes && <div className="text-xs text-slate-500 mt-1 italic">"{prod.notes}"</div>}
                    </td>
                    <td className="p-4 text-center">
                      <div className="font-bold text-slate-800">{prod.quantityProduced}</div>
                      <div className="text-xs text-slate-400">vs {dish.portions} teóricas</div>
                    </td>

                    <td className="p-4 text-right text-slate-600">
                      {theoreticalCostPerPortion.toFixed(2)} €/ud
                    </td>
                    <td className="p-4 text-right font-medium text-slate-800">
                      {realCostPerPortion.toFixed(2)} €/ud
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${isBad ? 'bg-red-100 text-red-700' : isGood ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                        {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {productions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No hay producciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        {productions.map(prod => {
          const dish = dishes.find(d => d.id === prod.recipeId);
          if (!dish) return null;

          const { totalCost } = calculateDishCost(dish, prod.variantSelection, stockProjection);
          const theoreticalCostPerPortion = totalCost / dish.portions;
          const realCostPerPortion = totalCost / prod.quantityProduced;
          
          const deviation = ((realCostPerPortion - theoreticalCostPerPortion) / theoreticalCostPerPortion) * 100;
          const isGood = deviation <= 0;
          const isBad = deviation > 5;

          return (
            <div key={prod.id} className="card-base p-5 flex flex-col gap-3 relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{new Date(prod.date).toLocaleDateString()}</div>
                  <h3 className="font-bold text-slate-800 text-lg">{dish.name}</h3>
                  {prod.mode === 'theoretical' && (
                    <div className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase w-fit mt-1">
                      🧪 Simulación
                    </div>
                  )}
                  {prod.notes && <p className="text-sm text-slate-500 mt-1 italic">"{prod.notes}"</p>}
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${isBad ? 'bg-red-100 text-red-700' : isGood ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                  {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                </span>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">Raciones</span>
                  <span className="font-bold text-lg text-slate-800">{prod.quantityProduced} <span className="text-sm font-normal text-slate-400">/ {dish.portions}</span></span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-500">Coste Real</span>
                  <span className="font-bold text-lg text-slate-800">{realCostPerPortion.toFixed(2)} €</span>
                  <span className="text-xs text-slate-400">vs {theoreticalCostPerPortion.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          );
        })}
        {productions.length === 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            No hay producciones registradas.
          </div>
        )}
      </div>

      {/* Bottom Sheet: Registrar Producción */}
      {showProductionForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 transition-opacity">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-serif font-bold text-xl text-slate-800">Registrar Producción</h3>
              <button 
                onClick={() => setShowProductionForm(false)}
                className="text-slate-400 hover:text-slate-600 p-2 -mr-2 active:scale-95 transition-transform"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <form onSubmit={handleRegisterProduction} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Receta</label>
                  <select 
                    className="input-base bg-white"
                    value={prodDishId}
                    onChange={(e) => {
                      setProdDishId(e.target.value);
                      setProdVariantSelection({});
                    }}
                    required
                  >
                    <option value="">Seleccionar receta...</option>
                    {dishes.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.hasInactiveIngredients ? '🚫 ' : ''}{d.name} ({d.portions} raciones)
                      </option>
                    ))}
                  </select>
                </div>

                {prodError && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                    <div className="text-red-600 mt-0.5"><AlertCircle size={18} /></div>
                    <div>
                      <h4 className="font-bold text-red-800 text-sm">Error de Registro</h4>
                      <p className="text-xs text-red-600 mt-1">{prodError}</p>
                    </div>
                  </div>
                )}

                {preFlight && preFlight.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                    <div className="text-red-600 mt-0.5"><Ban size={18} /></div>
                    <div>
                      <h4 className="font-bold text-red-800 text-sm">Escandallo Obsoleto</h4>
                      <ul className="text-xs text-red-600 mt-1 list-disc pl-4 space-y-1">
                        {preFlight.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {productionMode === 'real' && preFlight && preFlight.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                    <div className="text-amber-600 mt-0.5"><AlertCircle size={18} /></div>
                    <div>
                      <h4 className="font-bold text-amber-800 text-sm">Falta Stock (Warning)</h4>
                      <ul className="text-xs text-amber-700 mt-1 list-disc pl-4 space-y-1">
                        {preFlight.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 mt-2 font-medium italic">Puedes registrar la producción igual, pero el inventario quedará en negativo.</p>
                    </div>
                  </div>
                )}

                {selectedDishForProd?.variants && selectedDishForProd.variants.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                    <h4 className="font-medium text-slate-700 text-sm">Variantes utilizadas</h4>
                    {selectedDishForProd.variants.map((group, gIdx) => (
                      <div key={gIdx}>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{group.name}</label>
                        <select
                          className="input-base bg-white"
                          value={prodVariantSelection[group.name] ?? -1}
                          onChange={(e) => setProdVariantSelection({
                            ...prodVariantSelection,
                            [group.name]: parseInt(e.target.value)
                          })}
                        >
                          {(() => {
                            const baseOption = { name: 'Sin variante', quantity: 0, unit: '-' as any, costPerUnit: 0 };
                            const effectiveOptions = group.options.some(o => o.name === 'Sin variante') 
                              ? group.options 
                              : [baseOption, ...group.options];
                            
                            return effectiveOptions.map((opt, uiIdx) => {
                              const dataIdx = group.options.findIndex(o => o.name === opt.name);
                              return (
                                <option key={uiIdx} value={dataIdx}>{opt.name}</option>
                              );
                            });
                          })()}
                        </select>


                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Modo de Producción</label>
                  <select
                    className="input-base bg-white"
                    value={productionMode}
                    onChange={(e) => setProductionMode(e.target.value as ProductionMode)}
                  >
                    <option value="real">Producción real (descuenta stock)</option>
                    <option value="theoretical">Simulación (no afecta inventario)</option>
                  </select>
                  {productionMode === 'theoretical' && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      🧪 Simulación activa: no se descontará stock del inventario.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Raciones Reales Obtenidas</label>
                  <input 
                    type="number" inputMode="decimal" 
                    min="0.1" 
                    step="any" 
                    required
                    className="input-base text-lg font-bold"
                    value={prodRealQty}
                    onChange={(e) => setProdRealQty(e.target.value)}
                    placeholder={selectedDishForProd ? `Teórico: ${selectedDishForProd.portions}` : "Ej. 10"}
                  />
                </div>

                {/* Quick Incrementors/Decrementors */}
                <div className="grid grid-cols-4 gap-2">
                  {[-5, -1, 1, 5].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(prodRealQty) || (selectedDishForProd?.portions || 0);
                        const next = Math.max(0.1, current + val);
                        setProdRealQty(next.toString());
                      }}
                      className={`py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${val > 0 ? 'bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200' : 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200'}`}
                    >
                      {val > 0 ? '+' : ''}{val}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Notas (Opcional)</label>
                  <input 
                    type="text" 
                    className="input-base"
                    value={prodNotes}
                    onChange={(e) => setProdNotes(e.target.value)}
                    placeholder="Ej. Las patatas mermaron más de lo normal"
                  />
                </div>
                
                <div className="mt-4">
                  <button 
                    type="submit"
                    disabled={selectedDishForProd?.hasInactiveIngredients}
                    className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    {selectedDishForProd?.hasInactiveIngredients ? 'Producción Bloqueada' : 'Registrar Producción'}
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
