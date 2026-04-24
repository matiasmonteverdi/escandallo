import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  msg: string;
  type: ToastType;
}

// Disparador global ligero
export const toast = {
  success: (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { msg, type: 'success' } })),
  error: (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { msg, type: 'error' } })),
  info: (msg: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: { msg, type: 'info' } })),
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToast = (e: any) => {
      const { msg, type } = e.detail;
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      
      // Auto-dismiss tras 4 segundos
      setTimeout(() => removeToast(id), 4000);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, [removeToast]);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div 
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl shadow-xl border animate-in slide-in-from-right-full duration-300 ${
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-slate-900 border-slate-700 text-white'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />}
          {t.type === 'error' && <AlertCircle className="shrink-0 text-red-500" size={20} />}
          
          <p className="text-sm font-medium flex-1">{t.msg}</p>
          
          <button 
            onClick={() => removeToast(t.id)}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors opacity-50 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
