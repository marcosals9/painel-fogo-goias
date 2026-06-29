import React from 'react';
import { AlertTriangle, LogIn } from 'lucide-react';

export default function TimeoutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Sessão Expirada
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm sm:text-base leading-relaxed">
            Sua sessão expirou por inatividade ou devido a políticas de segurança. Para continuar, por favor, faça login novamente.
          </p>
          
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-orange-500/30 shadow-md"
          >
            <LogIn className="w-5 h-5" />
            Fazer Login
          </button>
        </div>
      </div>
    </div>
  );
}
