import { useState, useEffect } from 'react';
import { X, Save, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SupplierInfo {
  vendedor: string;
  whatsapp: string;
  formaPagamento: 'Boleto' | 'À Vista PIX' | 'Compra Local Cartão de Crédito' | '';
  dinamicaEntrega: string;
  orcamentoPlanejado: number;
}

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
  initialData?: SupplierInfo;
  onSave: (data: SupplierInfo) => void;
}

export default function SupplierModal({ isOpen, onClose, supplierName, initialData, onSave }: SupplierModalProps) {
  const [formData, setFormData] = useState<SupplierInfo>({
    vendedor: '',
    whatsapp: '',
    formaPagamento: '',
    dinamicaEntrega: '',
    orcamentoPlanejado: 0
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        orcamentoPlanejado: initialData.orcamentoPlanejado || 0
      });
    } else {
      setFormData({
        vendedor: '',
        whatsapp: '',
        formaPagamento: '',
        dinamicaEntrega: '',
        orcamentoPlanejado: 0
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-[92%] md:w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="bg-brand-purple p-6 text-white flex justify-between items-center shrink-0">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Configurações</span>
              <h2 className="text-xl font-black uppercase truncate max-w-[200px] md:max-w-[300px]">{supplierName}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Nome do Vendedor</label>
              <input
                type="text"
                value={formData.vendedor}
                onChange={(e) => setFormData({ ...formData, vendedor: e.target.value })}
                placeholder="Ex: João Silva"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all text-sm md:text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 md:py-3 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all text-sm md:text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Forma de Pagamento</label>
              <select
                value={formData.formaPagamento}
                onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all appearance-none cursor-pointer text-sm md:text-base"
              >
                <option value="">Selecione...</option>
                <option value="Boleto">Boleto</option>
                <option value="À Vista PIX">À Vista PIX</option>
                <option value="Compra Local Cartão de Crédito">Compra Local Cartão de Crédito</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Dinâmica de Entrega</label>
              <textarea
                value={formData.dinamicaEntrega}
                onChange={(e) => setFormData({ ...formData, dinamicaEntrega: e.target.value })}
                placeholder="Ex: Entrega toda terça-feira pela manhã..."
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all resize-none text-sm md:text-base"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Orçamento Planejado (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm md:text-base">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.orcamentoPlanejado === 0 ? '' : formData.orcamentoPlanejado}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    const numericValue = parseFloat(val);
                    setFormData({ ...formData, orcamentoPlanejado: isNaN(numericValue) ? 0 : numericValue });
                  }}
                  placeholder="1.500,00"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 md:py-3 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all text-sm md:text-base"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-brand-purple hover:bg-brand-purple-dark text-white py-4 rounded-2xl font-black text-base md:text-lg shadow-xl shadow-brand-purple/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest shrink-0"
            >
              <Save className="w-5 h-5" />
              Salvar Configurações
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
