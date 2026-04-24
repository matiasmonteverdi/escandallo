import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', interactive = false, onClick }) => {
  const baseClass = interactive ? 'card-interactive' : 'card-base';
  return (
    <div 
      className={`${baseClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
