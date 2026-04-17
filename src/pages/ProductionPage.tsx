import React, { useState } from 'react';
import { Plus, Edit2, AlertCircle, X, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { generateConsumptionEventsForProduction } from '../services/production.service';
import { computeStockProjection } from '../services/inventory.service';
import { Production } from '../data';
import { calculateDishCost } from '../App';

export const ProductionPage: React.FC = () => {
  const dishes = useAppStore(state => state.dishes);
  const productions = useAppStore(state => state.productions);
  const setProductions = useAppStore(state => state.setProductions);
  const inventoryEvents = useAppStore(state => state.inventoryEvents);
  const addInventoryEvent = useAppStore(state => state.addInventoryEvent);
  const inventorySnapshots = useAppStore(state => state.inventorySnapshots);

  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);

  const [prodDishId, setProdDishId] = useState('');
  const [prodRealQty, setProdRealQty] = useState('');
  const [prodNotes, setProdNotes] = useState('');
  const [prodVariantSelection, setProdVariantSelection] = useState<Record<string, number>>({});

  const [showProductionForm, setShowProductionForm] = useState(false);

  const handleRegisterProduction = (e: React.FormEvent) => {
    e.preventDefault();
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
    };

    const idempotencyKey = `prod_${newProdId}`;

    if (inventoryEvents.some(ev => ev.idempotencyKey === idempotencyKey)) {
      console.warn('Duplicate production event detected. Ignoring.');
      return;
    }
    
    const newEvents = generateConsumptionEventsForProduction(newProd, dish, dishes);

    newEvents.forEach(ev => addInventoryEvent(ev));
    setProductions([newProd, ...productions]);
    
    setProdDishId('');
    setProdRealQty('');
    setProdNotes('');
    setProdVariantSelection({});
    setShowProductionForm(false);
  };

  const selectedDishForProd = dishes.find(d => d.id === prodDishId);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Producción Real</h2>
          <p className="text-slate-500 mt-1">Registra lo que cocinas y compara el coste teórico con el real.</p>
        </div>
        <button 
          onClick={() => setShowProductionForm(true)}
          className="w-full md:w-auto bg-[#06b6d4] hover:bg-[#0891b2] active:scale-95 active:bg-[#0e7490] text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-3 shadow-md"
        >
          <Plus size={18} />
          Nueva Producción
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                      <div className="font-medium text-slate-800">{dish.name}</div>
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
            <div key={prod.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 relative">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{new Date(prod.date).toLocaleDateString()}</div>
                  <h3 className="font-bold text-slate-800 text-lg">{dish.name}</h3>
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
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent bg-white"
                    value={prodDishId}
                    onChange={(e) => {
                      setProdDishId(e.target.value);
                      setProdVariantSelection({});
                    }}
                    required
                  >
                    <option value="">Seleccionar receta...</option>
                    {dishes.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.portions} raciones teóricas)</option>
                    ))}
                  </select>
                </div>

                {selectedDishForProd?.variants && selectedDishForProd.variants.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                    <h4 className="font-medium text-slate-700 text-sm">Variantes utilizadas</h4>
                    {selectedDishForProd.variants.map((group, gIdx) => (
                      <div key={gIdx}>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{group.name}</label>
                        <select
                          className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent bg-white"
                          value={prodVariantSelection[group.name] || 0}
                          onChange={(e) => setProdVariantSelection({
                            ...prodVariantSelection,
                            [group.name]: parseInt(e.target.value)
                          })}
                        >
                          {group.options.map((opt, optIdx) => (
                            <option key={optIdx} value={optIdx}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Raciones Reales Obtenidas</label>
                  <input 
                    type="number" inputMode="decimal" 
                    min="0.1" 
                    step="any" 
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent text-lg font-bold"
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
                    className="w-full border border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                    value={prodNotes}
                    onChange={(e) => setProdNotes(e.target.value)}
                    placeholder="Ej. Las patatas mermaron más de lo normal"
                  />
                </div>
                
                <div className="mt-4">
                  <button 
                    type="submit"
                    className="w-full bg-[#06b6d4] hover:bg-[#0891b2] active:scale-95 active:bg-[#0e7490] text-white py-4 rounded-xl font-medium transition-all shadow-lg text-lg flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    Registrar Producción
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
