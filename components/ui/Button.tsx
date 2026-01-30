import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'black';
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  className = '', 
  disabled = false, 
  type = 'button',
  ...props 
}) => {
  const base = "px-4 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-bonny-red text-white shadow-lg shadow-rose-200",
    secondary: "bg-slate-800 text-white shadow-lg shadow-slate-300",
    outline: "border-2 border-slate-200 text-slate-600 bg-white hover:bg-slate-50",
    danger: "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100",
    ghost: "text-slate-500 hover:bg-slate-100",
    black: "bg-slate-900 text-white shadow-lg shadow-slate-300"
  };
  return (
    <button 
        type={type}
        onClick={onClick} 
        disabled={disabled} 
        className={`${base} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...props}
    >
      {children}
    </button>
  );
};