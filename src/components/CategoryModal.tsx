import { X, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
  onClearAll: () => void;
}

export default function CategoryModal({ 
  isOpen, 
  onClose, 
  categories, 
  onAddCategory, 
  onDeleteCategory,
  onClearAll
}: CategoryModalProps) {
  const [newCategory, setNewCategory] = useState('');

  const handleAdd = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onAddCategory(newCategory.trim());
      setNewCategory('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
          className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-brand-purple p-6 text-white shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tight">Gerenciar Categorias</h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Add New */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nova Categoria</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Ex: Limpeza"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                />
                <button 
                  onClick={handleAdd}
                  disabled={!newCategory.trim()}
                  className="bg-brand-purple text-white p-2.5 rounded-xl hover:bg-brand-purple-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-purple/20"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Categorias Atuais</label>
              <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {categories.map((cat) => (
                  <div 
                    key={cat}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-brand-purple/30 transition-all"
                  >
                    <span className="text-sm font-bold text-gray-700">{cat}</span>
                    {cat !== 'Sem Cat.' && (
                      <button 
                        onClick={() => onDeleteCategory(cat)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-6 bg-red-50 border-t border-red-100 shrink-0">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Zona de Perigo</span>
              </div>
              <p className="text-[10px] text-red-500 font-bold leading-tight">
                A limpeza total removerá permanentemente todos os produtos, históricos de preços e categorias customizadas.
              </p>
              <button 
                onClick={() => {
                  onClearAll();
                  onClose();
                }}
                className="w-full bg-red-500 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Limpar Todo o Sistema
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
