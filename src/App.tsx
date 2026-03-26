import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { 
  Upload, 
  FileCode, 
  X, 
  FileText, 
  History as HistoryIcon, 
  Search, 
  Plus, 
  Check,
  TrendingDown,
  TrendingUp,
  Calendar,
  ArrowDownToLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import HistoryModal, { HistoryItem } from './components/HistoryModal';

interface FileInfo {
  name: string;
  size: number;
  id: string;
  file: File;
}

interface ProductToValidate {
  arquivo: string;
  fornecedor: string;
  cnpj: string;
  dataEmissao: string;
  ean: string;
  produto: string;
  quantidade: number;
  valorUnitario: number;
  unidade: string;
  fatorConversao: number;
}

interface ConsolidatedProduct {
  ean: string;
  produto: string;
  quantidadeTotal: number;
  custoMedio: number;
  subtotalTotal: number;
  categoria: string;
  markup: number;
  venda: number;
  melhorPreco: number;
  selecionado: boolean;
}

export default function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'upload' | 'validation' | 'summary'>('upload');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productsToValidate, setProductsToValidate] = useState<ProductToValidate[]>([]);
  const [validatedProducts, setValidatedProducts] = useState<ProductToValidate[]>([]);
  const [consolidatedProducts, setConsolidatedProducts] = useState<ConsolidatedProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ConsolidatedProduct | null>(null);
  const [productHistories, setProductHistories] = useState<Record<string, HistoryItem[]>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'summary') {
      const histories: Record<string, HistoryItem[]> = {};

      const grouped = validatedProducts.reduce((acc, curr) => {
        const existing = acc.find(p => p.ean === curr.ean);
        const convertedQty = curr.quantidade * curr.fatorConversao;
        const subtotal = curr.quantidade * curr.valorUnitario;
        const unitCost = curr.valorUnitario / curr.fatorConversao;

        // Adiciona ao histórico real da nota atual
        if (!histories[curr.ean]) {
          histories[curr.ean] = [];
        }
        histories[curr.ean].push({
          data: curr.dataEmissao,
          fornecedor: curr.fornecedor,
          quantidade: convertedQty,
          valorUnitario: unitCost
        });

        if (existing) {
          existing.quantidadeTotal += convertedQty;
          existing.subtotalTotal += subtotal;
          existing.custoMedio = existing.subtotalTotal / existing.quantidadeTotal;
        } else {
          const custoMedio = subtotal / convertedQty;
          
          acc.push({
            ean: curr.ean,
            produto: curr.produto,
            quantidadeTotal: convertedQty,
            subtotalTotal: subtotal,
            custoMedio: custoMedio,
            categoria: 'Sem Cat.',
            markup: 0,
            venda: custoMedio,
            melhorPreco: custoMedio, // Inicializa igual ao custo
            selecionado: false
          });
        }
        return acc;
      }, [] as ConsolidatedProduct[]);

      // Garante que melhorPreco seja idêntico ao custoMedio nesta fase
      const finalized = grouped.map(p => ({
        ...p,
        melhorPreco: p.custoMedio
      }));

      setConsolidatedProducts(finalized.sort((a, b) => b.subtotalTotal - a.subtotalTotal));
      setProductHistories(histories);
    }
  }, [view, validatedProducts]);

  const openHistory = (product: ConsolidatedProduct) => {
    setSelectedProduct(product);
    setHistoryOpen(true);
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const xmlFiles = Array.from(newFiles).filter(file => 
      file.name.toLowerCase().endsWith('.xml')
    );

    const fileInfos: FileInfo[] = xmlFiles.map(file => ({
      name: file.name,
      size: file.size,
      id: Math.random().toString(36).substring(7) + Date.now(),
      file: file
    }));

    setFiles(prev => [...prev, ...fileInfos]);
  };

  const processFiles = async () => {
    setIsProcessing(true);
    const allProducts: any[] = [];

    try {
      for (const fileInfo of files) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(fileInfo.file);
        });

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Check for nfeProc
        if (!xmlDoc.getElementsByTagName("nfeProc").length && !xmlDoc.getElementsByTagName("NFe").length) {
          alert(`Arquivo XML inválido ou não é uma NF-e: ${fileInfo.name}`);
          continue;
        }

        const emit = xmlDoc.getElementsByTagName("emit")[0];
        const supplierName = emit?.getElementsByTagName("xNome")[0]?.textContent || "N/A";
        const supplierCNPJ = emit?.getElementsByTagName("CNPJ")[0]?.textContent || "N/A";

        const ide = xmlDoc.getElementsByTagName("ide")[0];
        const emissionDate = ide?.getElementsByTagName("dhEmi")[0]?.textContent || "N/A";

        const detTags = xmlDoc.getElementsByTagName("det");
        for (let i = 0; i < detTags.length; i++) {
          const det = detTags[i];
          const prod = det.getElementsByTagName("prod")[0];
          
          allProducts.push({
            arquivo: fileInfo.name,
            fornecedor: supplierName,
            cnpj: supplierCNPJ,
            dataEmissao: emissionDate,
            ean: prod?.getElementsByTagName("cEAN")[0]?.textContent || "N/A",
            produto: prod?.getElementsByTagName("xProd")[0]?.textContent || "N/A",
            quantidade: parseFloat(prod?.getElementsByTagName("qCom")[0]?.textContent || "0"),
            valorUnitario: parseFloat(prod?.getElementsByTagName("vUnCom")[0]?.textContent || "0")
          });
        }
      }

      if (allProducts.length > 0) {
        setProductsToValidate(allProducts.map(p => ({
          ...p,
          unidade: 'Unidade',
          fatorConversao: 1
        })));
        setView('validation');
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Erro ao processar arquivos:", error);
      alert("Ocorreu um erro ao processar os arquivos XML.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleConfirmNext = () => {
    const currentProduct = productsToValidate[currentIndex];
    setValidatedProducts(prev => [...prev, currentProduct]);

    if (currentIndex < productsToValidate.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setView('summary');
    }
  };

  const skipToSummary = () => {
    // Add remaining products to validated list if user wants to skip
    const remaining = productsToValidate.slice(currentIndex);
    setValidatedProducts(prev => [...prev, ...remaining]);
    setView('summary');
  };

  const resetApp = () => {
    setFiles([]);
    setProductsToValidate([]);
    setValidatedProducts([]);
    setConsolidatedProducts([]);
    setSearchTerm('');
    setCurrentIndex(0);
    setView('upload');
  };

  const updateConsolidatedProduct = (ean: string, field: keyof ConsolidatedProduct, value: any) => {
    setConsolidatedProducts(prev => prev.map(p => {
      if (p.ean === ean) {
        // Mantém o valor bruto para o campo que está sendo editado para permitir digitação fluida (ex: "1.")
        const updated = { ...p, [field]: value };
        
        // Lógica de cálculo automático Venda <-> Markup
        if (field === 'markup') {
          const markupVal = value === '' ? 0 : parseFloat(value) || 0;
          updated.venda = parseFloat((p.custoMedio * (1 + markupVal / 100)).toFixed(2));
        } else if (field === 'venda') {
          const vendaVal = value === '' ? 0 : parseFloat(value) || 0;
          if (p.custoMedio > 0) {
            updated.markup = parseFloat((((vendaVal / p.custoMedio) - 1) * 100).toFixed(2));
          } else {
            updated.markup = 0;
          }
        }
        
        return updated;
      }
      return p;
    }));
  };

  const copyMarkupBelow = (ean: string) => {
    const index = consolidatedProducts.findIndex(p => p.ean === ean);
    if (index === -1) return;
    
    const sourceMarkup = consolidatedProducts[index].markup;
    const markupVal = sourceMarkup === '' ? 0 : parseFloat(sourceMarkup as any) || 0;

    setConsolidatedProducts(prev => prev.map((p, i) => {
      if (i > index) {
        const updated = { ...p, markup: sourceMarkup };
        updated.venda = parseFloat((p.custoMedio * (1 + markupVal / 100)).toFixed(2));
        return updated;
      }
      return p;
    }));
  };

  const exportToCSV = () => {
    const headers = [
      'Fornecedor',
      'Data',
      'Produto',
      'GTIN',
      'Qtd Original',
      'Fator',
      'Qtd Convertida',
      'Custo Unitário',
      'Subtotal'
    ];

    const rows = validatedProducts.map(p => [
      p.fornecedor,
      p.dataEmissao,
      p.produto,
      p.ean,
      p.quantidade,
      p.fatorConversao,
      p.quantidade * p.fatorConversao,
      (p.valorUnitario / p.fatorConversao).toFixed(2),
      (p.quantidade * p.valorUnitario).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `importacao_xml_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateCurrentProduct = (field: keyof ProductToValidate, value: any) => {
    const updated = [...productsToValidate];
    updated[currentIndex] = { ...updated[currentIndex], [field]: value };
    setProductsToValidate(updated);
  };

  const currentProduct = productsToValidate[currentIndex];

  const markupMedio = consolidatedProducts.length > 0 
    ? consolidatedProducts.reduce((acc, curr) => acc + (parseFloat(curr.markup as any) || 0), 0) / consolidatedProducts.length 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-brand-purple text-white py-6 px-4 shadow-lg">
        <div className={`mx-auto flex items-center gap-3 flex-nowrap ${view === 'summary' ? 'max-w-full px-4 md:px-10' : 'max-w-5xl'}`}>
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate uppercase">
            {view === 'validation' ? 'Validando Importação' : 'Gestor de Compras - XML'}
          </h1>
        </div>
      </header>

      <main className={`w-full mx-auto px-3 py-6 md:p-8 ${view === 'summary' ? 'max-w-full' : 'max-w-5xl'}`}>
        <AnimatePresence mode="wait">
          {view === 'upload' ? (
            <motion.div
              key="upload-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-8"
            >
              {/* Upload Section */}
              <section className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 md:p-8">
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`
                      relative border-2 border-dashed rounded-xl p-4 md:p-12
                      flex flex-col items-center justify-center text-center transition-all duration-200
                      ${isDragging 
                        ? 'border-brand-purple bg-brand-purple/5 scale-[1.01]' 
                        : 'border-gray-200 hover:border-brand-purple/50 bg-gray-50/50'}
                    `}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileSelect}
                      accept=".xml"
                      multiple
                      className="hidden"
                    />
                    
                    <div className={`
                      p-3 md:p-4 rounded-full mb-4 transition-colors
                      ${isDragging ? 'bg-brand-purple text-white' : 'bg-brand-purple/10 text-brand-purple'}
                    `}>
                      <Upload className="w-6 h-6 md:w-10 md:h-10" />
                    </div>

                    <h2 className="text-base md:text-xl font-semibold mb-2">
                      Arraste seus arquivos XML aqui
                    </h2>
                    <p className="text-gray-500 mb-6 max-w-xs mx-auto text-xs md:text-base">
                      Selecione um ou mais arquivos de nota fiscal eletrônica (.xml)
                    </p>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full md:w-auto px-6 py-2.5 bg-brand-purple hover:bg-brand-purple-dark text-white rounded-lg font-medium transition-colors shadow-md hover:shadow-lg active:scale-95"
                    >
                      Selecionar Arquivos
                    </button>
                  </div>
                </div>
              </section>

              {/* File List Section */}
              {files.length > 0 && (
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                      Arquivos Selecionados
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {files.length}
                      </span>
                    </h3>
                  </div>

                  <div className="w-full px-0 space-y-3">
                    <AnimatePresence initial={false}>
                      {files.map((file) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group transition-colors w-full min-w-0"
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-brand-purple shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="font-medium text-gray-800 truncate block w-full max-w-[180px] xs:max-w-[250px] md:max-w-none text-sm md:text-base">
                                {file.name}
                              </p>
                              <p className="text-[10px] md:text-xs text-gray-500">
                                {formatSize(file.size)}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title="Remover arquivo"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Action Button */}
                  <div className="mt-8">
                    <button
                      onClick={processFiles}
                      disabled={isProcessing}
                      className={`
                        w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-lg transition-all active:scale-[0.98]
                        flex items-center justify-center gap-2
                        ${isProcessing 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-brand-purple hover:bg-brand-purple-dark text-white hover:shadow-brand-purple/20'}
                      `}
                    >
                      {isProcessing ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Upload className="w-5 h-5" />
                          </motion.div>
                          Processando...
                        </>
                      ) : (
                        'Processar Notas Fiscais'
                      )}
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          ) : view === 'validation' ? (
            <motion.div
              key="validation-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-6"
            >
              <button 
                onClick={skipToSummary}
                className="text-brand-purple font-bold text-sm hover:underline flex items-center gap-2"
              >
                Finalizar e Ver Resumo
                <X className="w-4 h-4 rotate-45" />
              </button>

              <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Progress Header */}
                <div className="bg-gray-900 text-white p-4 md:p-6 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Validando Importação</span>
                    <h2 className="text-xl md:text-2xl font-black">{currentIndex + 1}/{productsToValidate.length}</h2>
                  </div>
                  <div className="bg-brand-purple/20 p-2 md:p-3 rounded-xl border border-brand-purple/30">
                    <FileCode className="w-5 h-5 md:w-6 md:h-6 text-brand-purple" />
                  </div>
                </div>

                <div className="p-5 md:p-10">
                  {/* Product Info */}
                  <div className="mb-6 md:mb-8">
                    <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-2 leading-tight uppercase break-words">
                      {currentProduct.produto}
                    </h3>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 font-mono">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold">GTIN</span>
                      {currentProduct.ean}
                    </div>
                  </div>

                  {/* Inputs Grid */}
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
                    <div className="space-y-2">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider">Unidade</label>
                      <select 
                        value={currentProduct.unidade}
                        onChange={(e) => updateCurrentProduct('unidade', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3.5 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                      >
                        {['Unidade', 'Caixa', 'Fardo', 'Pacote', 'Display'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider">Fator Conversão</label>
                      <input 
                        type="number"
                        min="1"
                        value={currentProduct.fatorConversao}
                        onChange={(e) => updateCurrentProduct('fatorConversao', Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 md:py-3.5 font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Calculation Result */}
                  <div className="bg-brand-purple/5 rounded-2xl p-6 md:p-8 mb-8 md:mb-10 border border-brand-purple/10 flex flex-col items-center text-center">
                    <span className="text-[10px] md:text-xs font-black text-brand-purple/60 uppercase tracking-[0.2em] mb-3">Valor Unitário Calculado</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base md:text-lg font-bold text-brand-purple">R$</span>
                      <span className="text-4xl md:text-5xl font-black text-brand-purple tracking-tighter">
                        {(currentProduct.valorUnitario / currentProduct.fatorConversao).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="mt-4 text-[10px] md:text-xs text-gray-400 font-medium">
                      Valor XML: R$ {currentProduct.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    onClick={handleConfirmNext}
                    className="w-full bg-brand-purple hover:bg-brand-purple-dark text-white py-4 md:py-5 rounded-2xl font-black text-base md:text-lg shadow-xl shadow-brand-purple/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest"
                  >
                    Confirmar e Próximo
                    <X className="w-5 h-5 rotate-45" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="summary-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-full px-4 md:px-10 mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Summary Header */}
                <div className="bg-brand-purple p-6 md:p-8 text-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Gestão de Preços</h2>
                      <p className="text-brand-purple-light text-sm font-medium opacity-80">
                        Produtos em Análise
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={exportToCSV}
                        className="bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/20 flex items-center gap-2"
                      >
                        Exportar CSV
                      </button>
                      <button 
                        onClick={resetApp}
                        className="bg-white text-brand-purple px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all shadow-lg flex items-center gap-2"
                      >
                        Nova Importação
                      </button>
                    </div>
                  </div>

                  {/* Total Geral Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Markup Médio</span>
                      <span className="text-3xl font-black">
                        {markupMedio.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Itens Consolidados</span>
                      <span className="text-3xl font-black">{consolidatedProducts.length}</span>
                    </div>
                    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Arquivos Processados</span>
                      <span className="text-3xl font-black">{files.length}</span>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-col md:flex-row gap-4 items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                    <div className="relative w-full md:flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                      <input 
                        type="text"
                        placeholder="Buscar por GTIN ou Nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Content */}
                <div className="p-0">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">SEL</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-auto">Produto / GTIN</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Categoria</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Custo</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-32">Melhor</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-28">Markup (%)</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right w-40">Venda</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Hist.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {consolidatedProducts
                          .filter(p => 
                            p.produto.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.ean.includes(searchTerm)
                          )
                          .map((item) => (
                          <tr key={item.ean} className={`hover:bg-gray-50/50 transition-colors ${item.selecionado ? 'bg-brand-purple/5' : ''}`}>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => updateConsolidatedProduct(item.ean, 'selecionado', !item.selecionado)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  item.selecionado 
                                    ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20' 
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {item.selecionado ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800 text-sm uppercase leading-tight">{item.produto}</span>
                                <span className="text-[10px] font-mono text-gray-400 mt-1">{item.ean}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={item.categoria}
                                onChange={(e) => updateConsolidatedProduct(item.ean, 'categoria', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple outline-none"
                              >
                                {['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios'].map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-bold text-sm ${
                                  item.custoMedio > item.melhorPreco ? 'text-red-500' : 'text-green-600'
                                }`}>
                                  R$ {item.custoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {item.custoMedio > item.melhorPreco && (
                                  <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter flex items-center gap-0.5">
                                    <TrendingUp className="w-2 h-2" />
                                    +{(((item.custoMedio - item.melhorPreco) / item.melhorPreco) * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-bold text-sm ${item.custoMedio <= item.melhorPreco ? 'text-green-600' : 'text-gray-400'}`}>
                                R$ {item.melhorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 min-w-[100px]">
                                <input 
                                  type="number"
                                  value={item.markup}
                                  onChange={(e) => updateConsolidatedProduct(item.ean, 'markup', e.target.value)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-black text-center text-gray-700 focus:ring-2 focus:ring-brand-purple outline-none"
                                />
                                <button 
                                  onClick={() => copyMarkupBelow(item.ean)}
                                  title="Copiar este markup para todas as linhas abaixo"
                                  className="p-1 text-brand-purple hover:bg-brand-purple/10 rounded-md transition-colors shrink-0"
                                >
                                  <ArrowDownToLine className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] font-bold text-gray-400">R$</span>
                                <input 
                                  type="number"
                                  value={item.venda}
                                  onChange={(e) => updateConsolidatedProduct(item.ean, 'venda', e.target.value)}
                                  className="w-full bg-transparent text-right text-sm font-black text-brand-purple focus:outline-none"
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => openHistory(item)}
                                className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 flex items-center justify-center transition-all"
                              >
                                <HistoryIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {consolidatedProducts
                      .filter(p => 
                        p.produto.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.ean.includes(searchTerm)
                      )
                      .map((item) => (
                      <div key={item.ean} className={`p-4 ${item.selecionado ? 'bg-brand-purple/5' : ''}`}>
                        <div className="flex items-start gap-4 mb-4">
                          <button 
                            onClick={() => updateConsolidatedProduct(item.ean, 'selecionado', !item.selecionado)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                              item.selecionado 
                                ? 'bg-brand-purple text-white shadow-lg' 
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {item.selecionado ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm uppercase leading-tight mb-1">{item.produto}</h3>
                            <p className="text-[10px] font-mono text-gray-400">{item.ean}</p>
                          </div>
                          <button 
                            onClick={() => openHistory(item)}
                            className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center"
                          >
                            <HistoryIcon className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Custo Médio</span>
                            <span className="text-sm font-black text-brand-purple">
                              R$ {item.custoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <span className="text-[9px] font-black text-gray-400 uppercase block mb-1">Melhor Preço</span>
                            <span className={`text-sm font-black ${item.custoMedio <= item.melhorPreco ? 'text-green-600' : 'text-gray-400'}`}>
                              R$ {item.melhorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Markup (%)</label>
                            <div className="flex items-center gap-1">
                              <input 
                                type="number"
                                value={item.markup}
                                onChange={(e) => updateConsolidatedProduct(item.ean, 'markup', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-black text-gray-700"
                              />
                              <button 
                                onClick={() => copyMarkupBelow(item.ean)}
                                title="Copiar este markup para todas as linhas abaixo"
                                className="p-1.5 text-brand-purple hover:bg-brand-purple/10 rounded-md transition-colors shrink-0"
                              >
                                <ArrowDownToLine className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Venda</label>
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2">
                              <span className="text-[9px] font-bold text-gray-400 mr-1">R$</span>
                              <input 
                                type="number"
                                value={item.venda}
                                onChange={(e) => updateConsolidatedProduct(item.ean, 'venda', e.target.value)}
                                className="w-full bg-transparent text-right text-xs font-black text-brand-purple focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <select 
                            value={item.categoria}
                            onChange={(e) => updateConsolidatedProduct(item.ean, 'categoria', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700"
                          >
                            {['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios'].map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedProduct && (
          <HistoryModal
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            productName={selectedProduct.produto}
            ean={selectedProduct.ean}
            history={productHistories[selectedProduct.ean] || []}
            currentPrice={selectedProduct.custoMedio}
          />
        )}
      </main>
    </div>
  );
}
