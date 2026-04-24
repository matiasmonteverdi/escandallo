import React, { useMemo } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, TrendingUp, TrendingDown, ClipboardList, Package, DollarSign, Activity, Utensils, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { computeStockProjection } from '../services/inventory.service';
import { calculateDishCost } from '../App';
import { normalizeQuantity, formatCostForDisplay, formatQuantityForDisplay, formatNumber } from '../domain/units';
import { BaseUnit } from '../domain/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

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

  Object.entries(stockProjection).forEach(([name, data]) => {
    if (data.quantity <= 0) {
      const displayQty = formatQuantityForDisplay(data.quantity, data.unit as BaseUnit);
      const catItem = catalog.find(c => c.id === name);
      const displayName = catItem?.name || name;
      alerts.push({
        id: `out_${name}`,
        type: 'critical',
        message: `Agotado: ${displayName} (${formatNumber(displayQty.value)} ${displayQty.unit})`,
        cta: 'Reponer',
        actionUrl: 'inventory'
      });
    }
  });

  dishes.forEach(dish => {
    const manualResult = calculateDishCost(dish, {}, {});
    const liveResult = calculateDishCost(dish, {}, stockProjection);
    const manualCost = manualResult.totalCost;
    const liveCost = liveResult.totalCost;

    if (manualCost > 0) {
      const variance = ((liveCost - manualCost) / manualCost) * 100;
      if (Math.abs(variance) >= 5) {
        alerts.push({
          id: `var_${dish.id}`,
          type: variance > 0 ? 'critical' : 'warning',
          message: `Desviación: "${dish.name}" (${variance > 0 ? '+' : ''}${variance.toFixed(1)}%)`,
          cta: 'Revisar',
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

  const topInventoryValue = Object.entries(stockProjection)
    .map(([catId, data]) => {
      const catItem = catalog.find(c => c.id === catId);
      return { catId, name: catItem?.name || catId, totalValue: data.quantity * data.cost, data };
    })
    .filter(item => item.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  const recentEvents = [...inventoryEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="p-3 md:p-8 max-w-6xl mx-auto w-full pb-24 space-y-6 md:space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-900">Control de Mando</h2>
          <p className="text-slate-500 mt-1 font-medium">Estado real de tu operativa y costes.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Activity size={14} className="text-cyan-500" />
          Live Update
        </div>
      </header>

      {/* SHORTCUTS NATIVOS (SOLO MÓVIL) - Optimizados para pulgar */}
      <div className="md:hidden grid grid-cols-3 gap-3">
        <button onClick={() => onNavigate('recipes')} className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-soft active:scale-95 transition-all">
          <Utensils size={24} className="text-cyan-600 mb-2" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Escandallos</span>
        </button>
        <button onClick={() => onNavigate('production')} className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-soft active:scale-95 transition-all">
          <ClipboardList size={24} className="text-cyan-600 mb-2" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Producción</span>
        </button>
        <button onClick={() => onNavigate('inventory')} className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-soft active:scale-95 transition-all">
          <Package size={24} className="text-cyan-600 mb-2" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Inventario</span>
        </button>
      </div>

      {/* 1. ACCIONES REQUERIDAS (BENTO ALERTS) */}
      {alerts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Acciones Prioritarias</h3>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(alert => (
              <Card key={alert.id} className={`flex items-center justify-between p-3 border-l-4 ${alert.type === 'critical' ? 'border-l-red-500 bg-red-50/30' : 'border-l-amber-500 bg-amber-50/30'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={alert.type === 'critical' ? 'text-red-500' : 'text-amber-500'}>
                    <AlertCircle size={20} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                      {alert.type === 'critical' ? 'Crítico' : 'Aviso'}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{alert.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate(alert.actionUrl)}
                  className={`shrink-0 p-2 rounded-xl active:scale-90 transition-transform ${alert.type === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-100 text-amber-700'
                    }`}
                >
                  <ArrowRight size={16} />
                </button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 2. KPIs OPERATIVOS (BENTO GRID) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Métricas de Hoy</h3>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <Package size={20} />
              </div>
              <Badge type="neutral">Entradas</Badge>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{purchasesTodayAmount.toFixed(2)} €</p>
              <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Inversión en Cámara</p>
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-100 transition-colors">
                <TrendingUp size={20} />
              </div>
              <Badge type="inventory-no-consume">Consumo</Badge>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{productionCostToday.toFixed(2)} €</p>
              <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Coste Producción Real</p>
            </div>
          </Card>

          <Card className="p-6 flex flex-col justify-between group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600 group-hover:bg-cyan-100 transition-colors">
                <ClipboardList size={20} />
              </div>
              <Badge type="info">Volumen</Badge>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{portionsProducedToday}</p>
              <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Raciones Producidas</p>
            </div>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        {/* 3. CAPITAL INMOVILIZADO */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Inmovilizado Top 5</h3>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {topInventoryValue.map((item, idx) => {
                const qty = formatQuantityForDisplay(item.data.quantity, item.data.unit as BaseUnit);
                return (
                  <li key={item.catId} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-serif italic text-slate-300 w-4">{idx + 1}</span>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatNumber(qty.value)} {qty.unit} en stock</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">{item.totalValue.toFixed(2)} €</p>
                    </div>
                  </li>
                );
              })}
              {topInventoryValue.length === 0 && (
                <li className="p-10 text-center">
                  <p className="text-slate-400 text-sm italic font-medium">Sin stock registrado.</p>
                </li>
              )}
            </ul>
          </Card>
        </section>

        {/* 4. ÚLTIMA ACTIVIDAD (Ledger) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Actividad Reciente</h3>
            <button onClick={() => onNavigate('debug')} className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider hover:underline">Ver Todo</button>
          </div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {recentEvents.map((ev) => {
                const isPositive = ev.quantity > 0 || (ev.type === 'PURCHASE' && ev.quantity !== 0);
                const catItem = catalog.find(c => c.id === ev.ingredientId);
                const displayName = catItem?.name || ev.ingredientId;
                const displayQty = formatQuantityForDisplay(Math.abs(ev.quantity), ev.unit as BaseUnit);

                return (
                  <li key={ev.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge type={ev.type === 'PURCHASE' ? 'success' : 'inventory-no-consume'}>
                          {ev.type === 'PURCHASE' ? 'Entrada' : 'Salida'}
                        </Badge>
                        <p className="font-bold text-slate-800 text-sm truncate">{displayName}</p>
                      </div>
                      <p className="text-[10px] font-medium text-slate-400 uppercase">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {ev.source}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {ev.quantity > 0 ? '+' : (ev.quantity < 0 ? '-' : '')}{formatNumber(displayQty.value)} {displayQty.unit}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatNumber(ev.costPerUnit, 4)}€</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
};