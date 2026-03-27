import { X, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  productName
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-purple/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-red-500 p-6 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Confirmar Exclusão?</h2>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Produto Selecionado</p>
              <h3 className="text-lg font-black text-gray-900 leading-tight uppercase">{productName}</h3>
            </div>
            
            <p className="text-sm font-bold text-gray-500 leading-relaxed">
              Você tem certeza que deseja remover este produto e todo o seu histórico de preços? 
              <span className="block mt-2 text-red-500 font-black uppercase text-[10px] tracking-widest">Esta ação não pode ser desfeita.</span>
            </p>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={onConfirm}
                className="w-full bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Confirmar Exclusão
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
