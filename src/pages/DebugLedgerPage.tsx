import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';

export const DebugLedgerPage: React.FC = () => {
  const catalog = useAppStore(state => state.catalog);
  const inventoryEvents = useAppStore(state => state.inventoryEvents);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full pb-24">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl font-serif font-bold text-slate-800">Registro Contable</h2>
        <p className="text-slate-500 mt-1">Registro inmutable de todas las entradas y salidas.</p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="font-medium text-slate-700">Historial de Transacciones</span>
          <span className="text-xs bg-slate-200 px-2 py-1 rounded-full text-slate-600 font-medium">{inventoryEvents.length} eventos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Ingrediente</th>
                <th className="p-4 font-medium text-right">Cantidad</th>
                <th className="p-4 font-medium">Origen / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...inventoryEvents].reverse().map(ev => {
                const catItem = catalog.find(c => c.id === ev.ingredientId);
                const displayName = catItem?.name || ev.ingredientId;
                return (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-500">
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      ev.type === 'PURCHASE' ? 'bg-green-100 text-green-700' : 
                      ev.type === 'CONSUMPTION' ? 'bg-red-100 text-red-700' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ev.type === 'PURCHASE' && <ArrowDownRight size={14} />}
                      {ev.type === 'CONSUMPTION' && <ArrowUpRight size={14} />}
                      {ev.type === 'ADJUSTMENT' && <RefreshCw size={14} />}
                      {ev.type === 'PURCHASE' ? 'COMPRA' : ev.type === 'CONSUMPTION' ? 'CONSUMO' : 'AJUSTE'}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-800">{displayName}</td>
                  <td className={`p-4 text-right font-bold ${ev.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ev.quantity > 0 ? '+' : ''}{ev.quantity.toFixed(2)} <span className="text-sm font-normal text-slate-500">{ev.unit}</span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-700">{ev.source === 'manual' ? 'Manual' : 'Producción'}</div>
                    {ev.causality && <div className="text-xs text-slate-500 mt-0.5">{ev.causality}</div>}
                  </td>
                </tr>
              )})}
              {inventoryEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No hay movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="font-medium text-slate-700">Historial</span>
          <span className="text-xs bg-slate-200 px-2 py-1 rounded-full text-slate-600 font-medium">{inventoryEvents.length} eventos</span>
        </div>
        
        {[...inventoryEvents].reverse().map(ev => {
          const catItem = catalog.find(c => c.id === ev.ingredientId);
          const displayName = catItem?.name || ev.ingredientId;
          return (
          <div key={ev.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  ev.type === 'PURCHASE' ? 'bg-green-100 text-green-700' : 
                  ev.type === 'CONSUMPTION' ? 'bg-red-100 text-red-700' : 
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {ev.type === 'PURCHASE' && <ArrowDownRight size={20} />}
                  {ev.type === 'CONSUMPTION' && <ArrowUpRight size={20} />}
                  {ev.type === 'ADJUSTMENT' && <RefreshCw size={20} />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{displayName}</h4>
                  <span className="text-xs text-slate-400">{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div className={`text-right font-bold text-lg ${ev.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {ev.quantity > 0 ? '+' : ''}{ev.quantity.toFixed(2)}
                <span className="text-sm font-normal ml-1">{ev.unit}</span>
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Origen:</span>
                <span className="font-medium text-slate-700">{ev.source === 'manual' ? 'Manual' : 'Producción'}</span>
              </div>
              {ev.causality && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Motivo:</span>
                  <span className="font-medium text-slate-700 text-right">{ev.causality}</span>
                </div>
              )}
            </div>
          </div>
        )})}
        {inventoryEvents.length === 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
            No hay movimientos registrados.
          </div>
        )}
      </div>
    </div>
  );
};
