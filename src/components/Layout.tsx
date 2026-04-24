import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Utensils, 
  Package, 
  Settings, 
  Bell, 
  User, 
  Menu, 
  Search,
  X,
  ClipboardList,
  Terminal
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

export function Layout({ children, activePage, onPageChange }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'recipes', icon: Utensils, label: 'Escandallos' },
    { id: 'production', icon: ClipboardList, label: 'Producción' },
    { id: 'inventory', icon: Package, label: 'Inventario' },
    { id: 'debug', icon: Terminal, label: 'Registro Contable' },
    { id: 'config', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-[#1e293b] text-slate-300 flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-lg shadow-lg border border-slate-700" />
          <h1 className="text-white font-serif text-xl font-bold tracking-wider leading-tight">
            ESCANDALLO<br /><span className="text-[#06b6d4]">PANA</span>
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-inset ${
                activePage === item.id 
                  ? 'bg-[#06b6d4]/10 text-[#06b6d4] font-medium' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white shrink-0">
              <User size={16} />
            </div>
            <div className="text-sm overflow-hidden">
              <p className="text-white font-medium truncate">Chef Admin</p>
              <p className="text-slate-400 text-xs truncate">Restaurante Central</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar (Mobile) */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#1e293b] text-slate-300 flex flex-col z-50 transform transition-transform duration-300 md:hidden overflow-hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded shadow-md border border-slate-700" />
            <h1 className="text-white font-serif text-lg font-bold tracking-wider">
              ESCANDALLO<span className="text-[#06b6d4]">PANA</span>
            </h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => {
                onPageChange(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-inset ${
                activePage === item.id 
                  ? 'bg-[#06b6d4]/10 text-[#06b6d4] font-medium' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              className="md:hidden text-slate-500 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">Restaurante Central</span>
              <span>/</span>
              <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Search size={20} />
            </button>
            <button className="text-slate-400 hover:text-slate-600 relative min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
