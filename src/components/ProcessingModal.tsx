import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  total: number;
  current: number;
  summary: { updated: number; notFound: number } | null;
  isSyncing: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  progress,
  total,
  current,
  summary,
  isSyncing,
  onClose,
  onComplete
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl md:w-full"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Processando Planograma</h3>
              {summary && !isSyncing && (
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {isSyncing ? (
              <div className="text-center py-8">
                <p className="text-lg font-bold text-brand-purple animate-pulse">
                  Sincronizando valores atualizados com o banco de dados...
                </p>
              </div>
            ) : !summary ? (
              <div className="space-y-4">
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-sm font-bold text-gray-600 text-center">
                  Validando códigos de barras: {current} de {total}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                  <p className="text-sm font-bold text-gray-600">Resumo:</p>
                  <p className="text-2xl font-black text-green-600">{summary.updated} Preços atualizados</p>
                  <p className="text-2xl font-black text-red-600">{summary.notFound} Produtos não encontrados</p>
                </div>
                <button
                  onClick={onComplete}
                  className="w-full py-4 bg-brand-purple text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-purple-dark transition-all"
                >
                  Concluir
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
