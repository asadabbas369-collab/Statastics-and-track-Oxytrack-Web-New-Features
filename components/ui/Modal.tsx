import React from 'react';

export interface ModalConfig {
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'danger';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

export const Modal = ({ config, onClose }: { config: ModalConfig, onClose: () => void }) => {
    if (!config.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl relative transform transition-all scale-100 animate-[fadeIn_0.2s_ease-out]">
                <h3 className={`text-xl font-extrabold mb-2 ${config.type === 'danger' ? 'text-red-500' : 'text-slate-900'}`}>
                    {config.title}
                </h3>
                <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
                    {config.message}
                </p>
                <div className="flex gap-3">
                    {config.type !== 'alert' && (
                        <button 
                            onClick={onClose} 
                            className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            if (config.onConfirm) config.onConfirm();
                            onClose();
                        }} 
                        className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg text-sm transition-transform active:scale-95 ${
                            config.type === 'danger' ? 'bg-red-500 shadow-red-200' : 'bg-bonny-red shadow-rose-200'
                        }`}
                    >
                        {config.type === 'alert' ? 'OK' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};