import React, { useMemo } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, TrendingUp, TrendingDown, ClipboardList, Package, DollarSign, Activity, Utensils } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeStockProjection } from '../services/inventory.service';
import { calculateDishCost } from '../App';
import { normalizeQuantity, formatCostForDisplay, formatQuantityForDisplay } from '../domain/units';
import { BaseUnit } from '../domain/types';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const dishes = useAppStore(state => state.dishes);
  const inventoryEvents = useAppStore(state => state.inventoryEvents);
  const inventorySnapshots = useAppStore(state => state.inventorySnapshots);
  const productions = useAppStore(state => state.productions);
  const catalog = useAppStore(state => state.catalog);
  
  // Calculate current stock
  const latestSnapshot = inventorySnapshots.length > 0 ? inventorySnapshots[inventorySnapshots.length - 1] : null;
  const stockProjection = computeStockProjection(inventoryEvents, latestSnapshot);

  // 1. CRITICAL ALERTS
  const alerts: { id: string, type: 'critical' | 'warning', message: string, cta: string, actionUrl: string }[] = [];

  // A. Check for negative stock
  Object.entries(stockProjection).forEach(([name, data]) => {
    if (data.quantity <= 0) {
      alerts.push({
        id: `out_${name}`,
        type: 'critical',
        message: `Stock negativo o agotado: ${name} (${Number(data.quantity.toFixed(2))} ${data.unit})`,
        cta: 'Registrar Compra / Ajuste',
        actionUrl: 'inventory'
      });
    }
  });

  // B. Check for recipe cost deviations
  const costDeviations: { dishName: string, variancePercent: number, manualCost: number, liveCost: number }[] = [];
  
  dishes.forEach(dish => {
    // We calculate "theoretical / manual" vs "live"
    const manualResult = calculateDishCost(dish, {}, {});
    const liveResult = calculateDishCost(dish, {}, stockProjection);
    
    // Total dish base cost
    const manualCost = manualResult.totalCost;
    const liveCost = liveResult.totalCost;
    
    if (manualCost > 0) {
      const variance = ((liveCost - manualCost) / manualCost) * 100;
      if (Math.abs(variance) >= 5) {
        costDeviations.push({
          dishName: dish.name,
          variancePercent: variance,
          manualCost,
          liveCost
        });
        
        alerts.push({
          id: `var_${dish.id}`,
          type: variance > 0 ? 'critical' : 'warning',
          message: `Coste de "${dish.name}" ha ${variance > 0 ? 'subido' : 'bajado'} un ${Math.abs(variance).toFixed(1)}% debido al inventario en vivo.`,
          cta: 'Revisar Escandallo',
          actionUrl: 'recipes'
        });
      }
    }
  });

  // 2. TODAY'S SUMMARY
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let purchasesTodayAmount = 0;
  let productionCostToday = 0;
  let portionsProducedToday = 0;

  inventoryEvents.forEach(ev => {
    const evDate = new Date(ev.timestamp);
    if (evDate >= today) {
      if (ev.type === 'PURCHASE') {
        purchasesTodayAmount += (ev.quantity * ev.costPerUnit);
      } else if (ev.type === 'CONSUMPTION') {
        productionCostToday += (ev.quantity * ev.costPerUnit);
      }
    }
  });

  productions.forEach(prod => {
    const pDate = new Date(prod.date);
    if (pDate >= today) {
      portionsProducedToday += prod.quantityProduced;
    }
  });

  // 3. DONDE SE VA EL DINERO (Top Consumption & Top Expensive Dishes)
  // Top ingredients by cost total invested right now
  const topInventoryValue = Object.entries(stockProjection)
    .map(([catId, data]) => {
      const catItem = catalog.find(c => c.id === catId);
      return { catId, name: catItem?.name || catId, totalValue: data.quantity * data.cost, data };
    })
    .filter(item => item.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
    
  // Most expensive dishes (live cost per portion)
  const topDishesByCost = [...dishes]
    .map(d => {
      const { costPerPortion } = calculateDishCost(d, {}, stockProjection);
      return { name: d.name, cost: costPerPortion };
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  // 4. LATEST ACTIVITY
  const recentEvents = [...inventoryEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full pb-24 space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Centro de Control</h2>
        <p className="text-slate-500 mt-1">¿Qué está pasando y qué debemos hacer hoy?</p>
      </div>

      {/* SHORTCUTS NATIVOS (SOLO MÓVIL) */}
      <div className="md:hidden grid grid-cols-3 gap-3">
        <button onClick={() => onNavigate('recipes')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#06b6d4] focus:ring-offset-2">
          <Utensils size={24} className="text-[#06b6d4] mb-2" />
          <span className="text-xs font-bold text-slate-700">Recetas</span>
        </button>
        <button onClick={() => onNavigate('production')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#06b6d4] focus:ring-offset-2">
          <ClipboardList size={24} className="text-[#06b6d4] mb-2" />
          <span className="text-xs font-bold text-slate-700">Producción</span>
        </button>
        <button onClick={() => onNavigate('inventory')} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm active:bg-slate-50 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-[#06b6d4] focus:ring-offset-2">
          <Package size={24} className="text-[#06b6d4] mb-2" />
          <span className="text-xs font-bold text-slate-700">Inventario</span>
        </button>
      </div>

      {/* FILA 1: ALERTAS CRÍTICAS (ACTION BOARD) */}
      {alerts.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertCircle size={16} /> Alertas de Acción Inmediata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                alert.type === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${alert.type === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${alert.type === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>
                      {alert.type === 'critical' ? 'Requiere Atención' : 'Aviso'}
                    </h4>
                    <p className={`text-sm mt-0.5 ${alert.type === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                      {alert.message}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigate(alert.actionUrl)}
                  className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors active:scale-95 ${
                  alert.type === 'critical' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                }`}>
                  {alert.cta}
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILA 2: QUÉ ESTÁ PASANDO HOY (KPIs Operativos) */}
      <section>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} /> Operaciones Hoy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-2">
              <Package size={16} className="text-[#06b6d4]" />
              Compras / Gastos
            </span>
            <span className="text-3xl font-bold text-slate-800">{purchasesTodayAmount.toFixed(2)} €</span>
            <span className="text-xs text-slate-400 mt-2">Valor entrado a cámara hoy</span>
          </div>
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-amber-500" />
              Coste Producción
            </span>
            <span className="text-3xl font-bold text-slate-800">{productionCostToday.toFixed(2)} €</span>
            <span className="text-xs text-slate-400 mt-2">Coste real consumido hoy</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-2">
              <ClipboardList size={16} className="text-green-500" />
              Producción (Raciones)
            </span>
            <span className="text-3xl font-bold text-slate-800">{portionsProducedToday}</span>
            <span className="text-xs text-slate-400 mt-2">Salidas de recetas facturadas</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FILA 3: DONDE SE VA EL DINERO */}
        <section>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign size={16} /> Dónde se va el dinero
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h4 className="font-bold text-slate-800 text-sm">Capital Inmovilizado (Top 5 Ingredientes)</h4>
            </div>
            <ul className="divide-y divide-slate-100">
              {topInventoryValue.map((item, idx) => {
                const qty = formatQuantityForDisplay(item.data.quantity, item.data.unit as BaseUnit);
                return (
                  <li key={item.catId} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                        <p className="text-xs text-slate-500">{Number(qty.value.toFixed(2))} {qty.unit} en cámara</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800 text-sm">{item.totalValue.toFixed(2)} €</p>
                    </div>
                  </li>
                 );
              })}
              {topInventoryValue.length === 0 && (
                <li className="p-6 text-center text-slate-500 text-sm">Sin datos de inventario.</li>
              )}
            </ul>
          </div>
        </section>

        {/* FILA 4: ACTIVIDAD (Ledger Log) */}
        <section>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={16} /> Actividad Reciente del Registro Contable
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-sm">Últimos movimientos</h4>
              <button onClick={() => onNavigate('debug')} className="text-xs text-[#06b6d4] font-medium cursor-pointer hover:underline">Ver Registro Completo</button>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentEvents.map((ev) => {
                const isPositive = ev.type === 'PURCHASE';
                const catItem = catalog.find(c => c.id === ev.ingredientId);
                const displayName = catItem?.name || ev.ingredientId;
                return (
                  <li key={ev.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isPositive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {ev.type === 'PURCHASE' ? 'Entrada' : 'Salida'}
                        </span>
                        <p className="font-medium text-slate-800 text-sm">{displayName}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(ev.timestamp).toLocaleString()} • {ev.source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-amber-600'}`}>
                        {isPositive ? '+' : '-'}{ev.quantity} {ev.unit}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">@ {ev.costPerUnit.toFixed(4)}€</p>
                    </div>
                  </li>
                );
              })}
              {recentEvents.length === 0 && (
                <li className="p-6 text-center text-slate-500 text-sm">No hay movimientos recientes.</li>
              )}
            </ul>
          </div>
        </section>
      </div>

    </div>
  );
};
