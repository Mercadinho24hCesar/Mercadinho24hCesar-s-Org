import { X, Calendar, TrendingDown, TrendingUp, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useState, useMemo, useEffect } from 'react';

export interface HistoryItem {
  data: string;
  fornecedor: string;
  quantidade: number;
  valorUnitario: number;
  nNF?: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  ean: string;
  history: HistoryItem[];
  currentPrice: number;
  isDashboardExpanded: boolean;
}

export default function HistoryModal({ isOpen, onClose, productName, ean, history, currentPrice, isDashboardExpanded }: HistoryModalProps) {
  const [period, setPeriod] = useState<'30d' | '3m' | '1y'>('3m');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [isOpen]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    const days = period === '30d' ? 30 : period === '3m' ? 90 : 365;
    const cutoff = new Date(now.setDate(now.getDate() - days));
    
    // Filtra duplicatas baseadas no nNF se disponível, caso contrário usa a chave composta
    const uniqueHistory = new Map<string, HistoryItem>();
    history.forEach(item => {
      const key = item.nNF || `${item.data}-${item.fornecedor}-${item.valorUnitario}`;
      if (!uniqueHistory.has(key)) {
        uniqueHistory.set(key, item);
      }
    });

    return Array.from(uniqueHistory.values())
      .filter(item => !isNaN(new Date(item.data).getTime()) && new Date(item.data) >= cutoff)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [history, period]);

  const chartData = useMemo(() => {
    const data = filteredHistory.map(item => ({
      date: new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      price: item.valorUnitario,
      fullDate: item.data,
      isCurrent: false
    }));

    // Add current price as the last point
    data.push({
      date: 'Hoje',
      price: currentPrice,
      fullDate: new Date().toISOString(),
      isCurrent: true
    });

    return data;
  }, [filteredHistory, currentPrice]);

  const stats = useMemo(() => {
    const allPrices = [...history.map(h => h.valorUnitario), currentPrice];
    return {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
      avg: allPrices.reduce((a, b) => a + b, 0) / allPrices.length
    };
  }, [history, currentPrice]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
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
          className="relative w-full max-w-7xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-brand-purple p-6 md:p-8 text-white shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-white/20 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Histórico de Preços</span>
                  <span className="text-white/40 text-[10px] font-mono">{ean}</span>
                </div>
                <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight truncate leading-tight">
                  {productName}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all border border-white/10 shrink-0"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Menor Preço</span>
                <span className="text-lg md:text-xl font-black text-green-400">R$ {stats.min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Maior Preço</span>
                <span className="text-lg md:text-xl font-black text-red-400">R$ {stats.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Média</span>
                <span className="text-lg md:text-xl font-black">R$ {stats.avg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">Preço Atual</span>
                <span className={`text-lg md:text-xl font-black ${currentPrice <= stats.min ? 'text-green-400' : 'text-white'}`}>
                  R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
            {/* Chart Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Evolução de Preços
                </h3>
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                  {(['30d', '3m', '1y'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        period === p 
                          ? 'bg-white text-brand-purple shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {p === '30d' ? '30 Dias' : p === '3m' ? '3 Meses' : '1 Ano'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[300px] w-full overflow-hidden bg-gray-50 rounded-3xl border border-gray-100 p-4 md:p-6">
                {isDashboardExpanded && isReady && filteredHistory.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                        dy={10}
                      />
                      <YAxis 
                        width={60}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                        tickFormatter={(value) => `R$ ${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          padding: '12px'
                        }}
                        labelStyle={{ fontWeight: 800, color: '#4b5563', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#6366f1" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Table Section */}
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Histórico Detalhado
              </h3>
              
              <div className="hidden md:block overflow-hidden rounded-3xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fornecedor</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qtd</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Preço Unit.</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Variação %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {history.filter(item => !isNaN(new Date(item.data).getTime())).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((item, idx) => {
                      const variation = ((currentPrice - item.valorUnitario) / item.valorUnitario) * 100;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-700">
                              {new Date(item.data).toLocaleDateString('pt-BR')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-700 uppercase">{item.fornecedor}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-gray-500">{item.quantidade}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-gray-900">
                              R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${
                              variation > 0 ? 'bg-red-50 text-red-600' : variation < 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                            }`}>
                              {variation > 0 ? <TrendingUp className="w-3 h-3" /> : variation < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                              {variation === 0 ? 'ESTÁVEL' : `${variation > 0 ? '+' : ''}${variation.toFixed(1)}%`}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden space-y-3">
                {history.filter(item => !isNaN(new Date(item.data).getTime())).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((item, idx) => {
                  const variation = ((currentPrice - item.valorUnitario) / item.valorUnitario) * 100;
                  return (
                    <div key={idx} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${
                          variation > 0 ? 'bg-red-50 text-red-600' : variation < 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                        }`}>
                          {variation === 0 ? 'ESTÁVEL' : `${variation > 0 ? '+' : ''}${variation.toFixed(1)}%`}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900 uppercase truncate flex-1 mr-4">{item.fornecedor}</span>
                        <span className="text-sm font-black text-gray-900">R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">Quantidade: {item.quantidade}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
