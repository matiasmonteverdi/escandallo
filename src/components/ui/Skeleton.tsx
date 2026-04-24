import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const variantClasses = {
    text: 'h-4 w-3/4 rounded',
    rect: 'rounded-xl',
    circle: 'rounded-full'
  };

  return (
    <div className={`animate-pulse bg-slate-200 ${variantClasses[variant]} ${className}`} />
  );
};
