import React from 'react';

type BadgeType = 'inventory-consume' | 'inventory-no-consume' | 'manual' | 'danger' | 'success' | 'neutral' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  type?: BadgeType;
  className?: string;
}

const styles: Record<BadgeType, string> = {
  'inventory-consume': 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  'inventory-no-consume': 'bg-amber-100 text-amber-700 border border-amber-200',
  'manual': 'bg-slate-100 text-slate-600 border border-slate-200',
  'danger': 'bg-red-100 text-red-700 border border-red-200',
  'success': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'neutral': 'bg-slate-100 text-slate-600 border border-slate-200',
  'info': 'bg-indigo-100 text-indigo-700 border border-indigo-200'
};

export const Badge: React.FC<BadgeProps> = ({ children, type = 'neutral', className = '' }) => {
  return (
    <span className={`badge-base ${styles[type]} ${className}`}>
      {children}
    </span>
  );
};
