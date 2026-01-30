import React from 'react';

export interface CardProps {
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-3xl p-5 shadow-sm border border-slate-50 ${className}`}>
    {children}
  </div>
);