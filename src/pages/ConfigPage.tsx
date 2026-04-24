import React, { useState } from 'react';
import { RefreshCw, Trash2, AlertTriangle, FlaskConical, CheckCircle2, X } from 'lucide-react';
import { exampleDataService } from '../services/exampleData.service';

export const ConfigPage: React.FC = () => {
  const [wiping, setWiping] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [demoConfirmText, setDemoConfirmText] = useState('');
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleWipeDatabase = async () => {
    if (wipeConfirmText !== 'BORRAR') return;

    setWiping(true);
    try {
      await exampleDataService.wipeDatabase();
      setSuccessMessage('Base de datos borrada. Reiniciando aplicación...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error wiping database:', err);
      alert('Error al borrar la base de datos. Revisa la consola.');
      setWiping(false);
    }
  };

  const handleSeedDemo = async () => {
    if (demoConfirmText !== 'DEMO') return;

    setSeeding(true);
    try {
      await exampleDataService.seedDemoDataset();
      setSuccessMessage('Dataset profesional cargado correctamente. Redirigiendo...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error seeding example:', err);
      alert('Error al cargar el ejemplo. Revisa la consola.');
      setSeeding(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full pb-24">
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-bold text-slate-800">Configuración</h2>
        <p className="text-slate-500 mt-1">Gestión del sistema y herramientas de mantenimiento.</p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 z-10 relative">
          <CheckCircle2 className="shrink-0" size={20} />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Entorno de pruebas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <FlaskConical size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Dataset Profesional (Demo)</h3>
              <p className="text-sm text-slate-500">Carga un entorno completo para pruebas y formación.</p>
            </div>
          </div>
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                Se añadirán datos de ejemplo (catálogo, inventario y producciones) sin eliminar tus recetas.
              </p>
              <p className="text-xs text-slate-400 mt-2 italic">
                Ideal para validar el funcionamiento del sistema con datos reales de cocina.
              </p>
            </div>
            <button
              onClick={() => setShowDemoModal(true)}
              disabled={seeding}
              className="shrink-0 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={16} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Cargando...' : 'Cargar Dataset Demo'}
            </button>
          </div>
        </div>

        {/* Borrar base de datos */}
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-red-100 bg-red-50 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-red-800">Zona de Peligro</h3>
              <p className="text-sm text-red-600">Acciones irreversibles. Procede con precaución.</p>
            </div>
          </div>
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-800">Borrar toda la base de datos</p>
              <p className="text-sm text-slate-500 mt-1">
                Elimina <strong>todos</strong> los datos: catálogo, recetas, inventario, producciones y registros. El sistema quedará vacío.
              </p>
            </div>
            <button
              onClick={() => setShowWipeModal(true)}
              disabled={wiping}
              className="shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={16} className={wiping ? 'animate-spin' : ''} />
              {wiping ? 'Borrando...' : 'Borrar Todo'}
            </button>
          </div>
        </div>
      </div>

      {/* Demo Loading Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FlaskConical className="text-indigo-600" size={24} />
                Cargar Dataset Demo
              </h3>
              <button 
                onClick={() => { setShowDemoModal(false); setDemoConfirmText(''); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 flex gap-3">
                <AlertTriangle className="shrink-0 text-amber-500" size={20} />
                <div>
                  <p className="font-bold">¿Qué ocurrirá?</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1 text-slate-700">
                    <li>Se cargarán ingredientes y recetas de ejemplo.</li>
                    <li>Se generará historial de inventario y producción.</li>
                    <li><strong>Tus recetas personalizadas NO se borrarán.</strong></li>
                    <li>Los datos demo aparecerán con el prefijo <span className="font-mono bg-amber-100 px-1 rounded text-xs">[DEMO]</span>.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Para confirmar, escribe <span className="font-bold text-slate-900">DEMO</span> debajo:
                </label>
                <input
                  type="text"
                  value={demoConfirmText}
                  onChange={(e) => setDemoConfirmText(e.target.value.toUpperCase())}
                  placeholder="Escribe DEMO aquí..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  autoFocus
                />
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => { setShowDemoModal(false); setDemoConfirmText(''); }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSeedDemo}
                  disabled={demoConfirmText !== 'DEMO' || seeding}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-all shadow-md active:scale-95"
                >
                  {seeding ? 'Cargando...' : 'Confirmar Carga'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wipe Database Modal */}
      {showWipeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-red-100">
            <div className="p-6 border-b border-red-50 flex justify-between items-center bg-red-50/50">
              <h3 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <Trash2 className="text-red-600" size={24} />
                Borrar Todo
              </h3>
              <button 
                onClick={() => { setShowWipeModal(false); setWipeConfirmText(''); }}
                className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800 flex gap-3">
                <AlertTriangle className="shrink-0 text-red-500" size={20} />
                <div>
                  <p className="font-bold">⚠️ ADVERTENCIA CRÍTICA</p>
                  <p className="mt-1 leading-relaxed">
                    Esta acción es <strong>irreversible</strong> y eliminará permanentemente:
                  </p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Todo el Catálogo de ingredientes.</li>
                    <li>Todas tus Recetas y Escandallos.</li>
                    <li>Todo el historial de Inventario y Producción.</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Para confirmar el borrado total, escribe <span className="font-bold text-red-600">BORRAR</span> debajo:
                </label>
                <input
                  type="text"
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value.toUpperCase())}
                  placeholder="Escribe BORRAR aquí..."
                  className="w-full px-4 py-3 bg-red-50/30 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-mono text-red-900 placeholder:text-red-200"
                  autoFocus
                />
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => { setShowWipeModal(false); setWipeConfirmText(''); }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleWipeDatabase}
                  disabled={wipeConfirmText !== 'BORRAR' || wiping}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-all shadow-md active:scale-95"
                >
                  {wiping ? 'Borrando...' : 'Confirmar Borrado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
