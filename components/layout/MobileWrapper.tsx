import React from 'react';

export interface MobileWrapperProps {
  children?: React.ReactNode;
  className?: string;
}

export const MobileWrapper: React.FC<MobileWrapperProps> = ({ children, className = '' }) => (
  <div className="flex justify-center min-h-screen bg-gray-100 text-slate-800 font-sans">
    <div className={`w-full max-w-[448px] bg-slate-50 h-[100dvh] flex flex-col relative shadow-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  </div>
);