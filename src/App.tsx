import { useState, useRef, DragEvent, ChangeEvent, useEffect, useMemo } from 'react';
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
  ArrowDownToLine,
  Settings,
  Trash2,
  ArrowLeft,
  Users,
  LayoutDashboard,
  MessageCircle,
  Edit2,
  ExternalLink,
  Wallet,
  ChevronDown,
  ChevronUp,
  Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import HistoryModal, { HistoryItem } from './components/HistoryModal';
import CategoryModal from './components/CategoryModal';
import SupplierModal, { SupplierInfo } from './components/SupplierModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zdcdsgpfoecfrkpjckuq.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8yKZ2HgBaTty9SmBAKXbjA_IOoeYjxe';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  nNF: string;
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
  const [view, setView] = useState<'upload' | 'validation' | 'summary' | 'suppliers'>('upload');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productsToValidate, setProductsToValidate] = useState<ProductToValidate[]>([]);
  const [validatedProducts, setValidatedProducts] = useState<ProductToValidate[]>([]);
  const [consolidatedProducts, setConsolidatedProducts] = useState<ConsolidatedProduct[]>(() => {
    const saved = localStorage.getItem('smartstore_consolidated');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ConsolidatedProduct | null>(null);
  const [productHistories, setProductHistories] = useState<Record<string, HistoryItem[]>>(() => {
    const saved = localStorage.getItem('smartstore_histories');
    return saved ? JSON.parse(saved) : {};
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('smartstore_categories');
    return saved ? JSON.parse(saved) : ['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios'];
  });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [suppliersData, setSuppliersData] = useState<Record<string, SupplierInfo>>(() => {
    const saved = localStorage.getItem('smartstore_suppliers');
    return saved ? JSON.parse(saved) : {};
  });
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'checking' | 'synced' | 'error'>('checking');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset Total de Dados
    const resetDone = localStorage.getItem('smartstore_reset_done');
    if (!resetDone) {
      localStorage.clear();
      setConsolidatedProducts([]);
      setProductHistories({});
      setSuppliersData({});
      setCategories(['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios']);
      localStorage.setItem('smartstore_reset_done', 'true');
    }

    if (consolidatedProducts.length > 0 && view === 'upload') {
      setView('summary');
    }
    console.log("Tentando conectar ao Supabase em:", supabaseUrl);
    loadFromCloud();

    // Verificação de Inicialização
    const testConnection = async () => {
      try {
        await supabase.from('categorias').select('*', { count: 'exact', head: true });
        console.log('✅ Supabase Conectado!');
      } catch (err) {
        console.error('❌ Erro no Supabase:', err);
      }
    };
    testConnection();
  }, []);

  const loadFromCloud = async () => {
    setSyncStatus('checking');
    try {
      // Carregar categorias
      const { data: cats } = await supabase.from('categorias').select('nome');
      if (cats && cats.length > 0) {
        setCategories(cats.map(c => c.nome));
      } else {
        setCategories(['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios']);
        localStorage.removeItem('smartstore_categories');
      }

      // Carregar fornecedores
      const { data: sups } = await supabase.from('fornecedores').select('*');
      if (sups && sups.length > 0) {
        const updated: Record<string, SupplierInfo> = {};
        sups.forEach(s => {
          updated[s.nome] = {
            vendedor: s.vendedor,
            whatsapp: s.whatsapp,
            formaPagamento: s.forma_pagamento,
            dinamicaEntrega: s.dinamica_entrega,
            orcamentoPlanejado: s.orcamento_planejado
          };
        });
        setSuppliersData(updated);
      } else {
        setSuppliersData({});
        localStorage.removeItem('smartstore_suppliers');
      }

      // Carregar produtos consolidados
      const { data: prods } = await supabase.from('produtos_consolidados').select('*');
      if (prods && prods.length > 0) {
        const updated = prods.map(p => ({
          ean: p.ean,
          produto: p.produto,
          categoria: p.categoria || 'Sem Cat.',
          markup: p.markup,
          venda: p.venda,
          melhorPreco: p.melhor_preco,
          custoMedio: p.custo_medio,
          quantidadeTotal: 0, 
          subtotalTotal: 0,
          selecionado: false
        }));
        setConsolidatedProducts(updated);
      } else {
        setConsolidatedProducts([]);
        localStorage.removeItem('smartstore_consolidated');
      }

      // Carregar histórico
      const { data: hist } = await supabase.from('historico_compras').select('*');
      if (hist && hist.length > 0) {
        const updated: Record<string, HistoryItem[]> = {};
        hist.forEach(h => {
          if (!updated[h.ean]) updated[h.ean] = [];
          updated[h.ean].push({
            data: h.data,
            fornecedor: h.fornecedor,
            quantidade: h.quantidade,
            valorUnitario: h.valor_unitario
          });
        });
        setProductHistories(updated);
      } else {
        setProductHistories({});
        localStorage.removeItem('smartstore_histories');
      }
      setSyncStatus('synced');
    } catch (error) {
      console.error('Erro ao carregar dados do Supabase:', error);
      setSyncStatus('error');
    }
  };

  const saveToCloud = async (type: 'product' | 'category' | 'supplier' | 'history' | 'delete' | 'delete_category', data: any) => {
    try {
      if (type === 'product') {
        await supabase.from('produtos_consolidados').upsert({
          ean: data.ean,
          produto: data.produto,
          categoria: data.categoria,
          markup: data.markup,
          venda: data.venda,
          melhor_preco: data.melhorPreco,
          custo_medio: data.custoMedio
        });
      } else if (type === 'category') {
        await supabase.from('categorias').upsert({ nome: data });
      } else if (type === 'supplier') {
        await supabase.from('fornecedores').upsert({
          nome: data.nome,
          vendedor: data.vendedor,
          whatsapp: data.whatsapp,
          forma_pagamento: data.formaPagamento,
          dinamica_entrega: data.dinamicaEntrega,
          orcamento_planejado: data.orcamentoPlanejado
        });
      } else if (type === 'history') {
        await supabase.from('historico_compras').upsert({
          ean: data.ean,
          data: data.data,
          fornecedor: data.fornecedor,
          quantidade: data.quantidade,
          valor_unitario: data.valorUnitario
        });
      } else if (type === 'delete') {
        await supabase.from('produtos_consolidados').delete().eq('ean', data.ean);
        // Histórico é deletado em cascata no banco (conforme schema)
      } else if (type === 'delete_category') {
        await supabase.from('categorias').delete().eq('nome', data);
      }
      setSyncStatus('synced');
    } catch (error) {
      console.error(`Erro ao sincronizar ${type} com Supabase:`, error);
      setSyncStatus('error');
    }
  };

  const migrateLocalToCloud = async () => {
    setIsSyncing(true);
    try {
      // Categorias
      for (const cat of categories) {
        await saveToCloud('category', cat);
      }

      // Fornecedores
      for (const nome of Object.keys(suppliersData)) {
        const info = suppliersData[nome];
        await saveToCloud('supplier', { nome, ...info });
      }

      // Produtos e Históricos
      for (const prod of consolidatedProducts) {
        await saveToCloud('product', prod);
        const history = productHistories[prod.ean] || [];
        for (const h of history) {
          await saveToCloud('history', { ean: prod.ean, ...h });
        }
      }

      console.log(`Dados sincronizados com sucesso! ${consolidatedProducts.length} produtos enviados.`);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Erro na migração:', error);
      console.log('Erro ao migrar dados. Verifique o console.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('smartstore_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('smartstore_consolidated', JSON.stringify(consolidatedProducts));
  }, [consolidatedProducts]);

  useEffect(() => {
    localStorage.setItem('smartstore_histories', JSON.stringify(productHistories));
  }, [productHistories]);

  useEffect(() => {
    localStorage.setItem('smartstore_suppliers', JSON.stringify(suppliersData));
  }, [suppliersData]);

  const finalizeValidation = (items: ProductToValidate[]) => {
    const updatedConsolidated = [...consolidatedProducts];
    const updatedHistories = { ...productHistories };

    items.forEach(curr => {
      const convertedQty = curr.quantidade * curr.fatorConversao;
      const subtotal = curr.quantidade * curr.valorUnitario;
      const unitCost = curr.valorUnitario / curr.fatorConversao;

      if (!updatedHistories[curr.ean]) {
        updatedHistories[curr.ean] = [];
      }
      
      // Duplication check using nNF as unique identifier
      const isDuplicate = updatedHistories[curr.ean].some(h => 
        h.nNF === curr.nNF
      );

      if (!isDuplicate) {
        const historyItem = {
          data: curr.dataEmissao,
          fornecedor: curr.fornecedor,
          quantidade: convertedQty,
          valorUnitario: unitCost,
          nNF: curr.nNF
        };
        updatedHistories[curr.ean].push(historyItem);
        saveToCloud('history', { ean: curr.ean, ...historyItem });
      }

      const existingIndex = updatedConsolidated.findIndex(p => p.ean === curr.ean);
      if (existingIndex !== -1) {
        const existing = { ...updatedConsolidated[existingIndex] };
        existing.custoMedio = unitCost;
        existing.quantidadeTotal += convertedQty;
        existing.subtotalTotal += subtotal;
        if (unitCost < existing.melhorPreco) {
          existing.melhorPreco = unitCost;
        }
        const markupVal = parseFloat(existing.markup as any) || 0;
        existing.venda = parseFloat((existing.custoMedio * (1 + markupVal / 100)).toFixed(2));
        updatedConsolidated[existingIndex] = existing;
        saveToCloud('product', existing);
      } else {
        const newProduct = {
          ean: curr.ean,
          produto: curr.produto,
          quantidadeTotal: convertedQty,
          subtotalTotal: subtotal,
          custoMedio: unitCost,
          categoria: 'Sem Cat.',
          markup: 0,
          venda: unitCost,
          melhorPreco: unitCost,
          selecionado: false
        };
        updatedConsolidated.push(newProduct);
        saveToCloud('product', newProduct);
      }
    });

    setConsolidatedProducts(updatedConsolidated.sort((a, b) => b.subtotalTotal - a.subtotalTotal));
    setProductHistories(updatedHistories);
    setView('summary');
    setValidatedProducts([]);
  };

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
        const nNF = ide?.getElementsByTagName("nNF")[0]?.textContent || "N/A";

        const detTags = xmlDoc.getElementsByTagName("det");
        for (let i = 0; i < detTags.length; i++) {
          const det = detTags[i];
          const prod = det.getElementsByTagName("prod")[0];
          
          allProducts.push({
            arquivo: fileInfo.name,
            fornecedor: supplierName,
            cnpj: supplierCNPJ,
            dataEmissao: emissionDate,
            nNF: nNF,
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
    const newValidated = [...validatedProducts, currentProduct];
    setValidatedProducts(newValidated);

    if (currentIndex < productsToValidate.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finalizeValidation(newValidated);
    }
  };

  const skipToSummary = () => {
    // Add remaining products to validated list if user wants to skip
    const remaining = productsToValidate.slice(currentIndex);
    const newValidated = [...validatedProducts, ...remaining];
    setValidatedProducts(newValidated);
    finalizeValidation(newValidated);
  };

  const resetApp = () => {
    setFiles([]);
    setProductsToValidate([]);
    setValidatedProducts([]);
    setSearchTerm('');
    setCurrentIndex(0);
    setView('upload');
  };

  const clearAllData = () => {
    if (window.confirm('ATENÇÃO: Isso apagará todos os produtos, históricos e categorias personalizadas. Deseja continuar?')) {
      localStorage.removeItem('smartstore_consolidated');
      localStorage.removeItem('smartstore_histories');
      localStorage.removeItem('smartstore_categories');
      setConsolidatedProducts([]);
      setProductHistories({});
      setCategories(['Sem Cat.', 'Bebidas', 'Mercearia', 'Higiene', 'Limpeza', 'Frios']);
      resetApp();
    }
  };

  const clearBadHistory = () => {
    const updatedHistories = { ...productHistories };
    Object.keys(updatedHistories).forEach(ean => {
      const history = updatedHistories[ean];
      const uniqueHistory: HistoryItem[] = [];
      const seen = new Set();
      history.forEach(item => {
        const key = `${item.data}-${item.fornecedor}-${item.valorUnitario}`;
        if (!seen.has(key)) {
          uniqueHistory.push(item);
          seen.add(key);
        }
      });
      updatedHistories[ean] = uniqueHistory;
    });
    setProductHistories(updatedHistories);
    localStorage.setItem('smartstore_histories', JSON.stringify(updatedHistories));
    console.log("Histórico limpo de duplicatas.");
  };

  useEffect(() => {
    (window as any).clearBadHistory = clearBadHistory;
  }, [productHistories]);

  const updateConsolidatedProduct = (ean: string, field: keyof ConsolidatedProduct, value: any) => {
    const product = consolidatedProducts.find(p => p.ean === ean);
    if (!product) return;

    const updatedProd = { ...product, [field]: value };
    if (field === 'markup') {
      const markupVal = value === '' ? 0 : parseFloat(value) || 0;
      updatedProd.venda = parseFloat((product.custoMedio * (1 + markupVal / 100)).toFixed(2));
    } else if (field === 'venda') {
      const vendaVal = value === '' ? 0 : parseFloat(value) || 0;
      if (product.custoMedio > 0) {
        updatedProd.markup = parseFloat((((vendaVal / product.custoMedio) - 1) * 100).toFixed(2));
      } else {
        updatedProd.markup = 0;
      }
    }

    setConsolidatedProducts(prev => prev.map(p => p.ean === ean ? updatedProd : p));
    saveToCloud('product', updatedProd);
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

  const addCategory = (category: string) => {
    if (!categories.includes(category)) {
      setCategories(prev => [...prev, category]);
      saveToCloud('category', category);
    }
  };

  const deleteCategory = (category: string) => {
    if (category === 'Sem Cat.') return;
    
    // Verifica se a categoria está em uso
    const isUsed = consolidatedProducts.some(p => p.categoria === category);
    if (isUsed) {
      alert(`A categoria "${category}" está sendo usada por um ou mais produtos e não pode ser excluída.`);
      return;
    }

    setCategories(prev => prev.filter(c => c !== category));
    saveToCloud('delete_category', category);
  };

  const removeProduct = (ean: string) => {
    setProductToDelete(ean);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;
    
    setConsolidatedProducts(prev => prev.filter(p => p.ean !== productToDelete));
    setProductHistories(prev => {
      const updated = { ...prev };
      delete updated[productToDelete];
      return updated;
    });
    saveToCloud('delete', { ean: productToDelete });
    setProductToDelete(null);
  };

  const syncToCloud = async () => {
    setIsSyncing(true);
    try {
      // 1. Sincronizar Categorias
      if (categories.length > 0) {
        const categoriasData = categories.map(c => ({ nome: c }));
        const { error: catError } = await supabase.from('categorias').upsert(categoriasData, { onConflict: 'nome' });
        if (catError) throw catError;
        console.log("Categorias sincronizadas.");
      }

      // 2. Sincronizar Fornecedores
      const fornecedoresArray = Object.entries(suppliersData).map(([nome, data]) => {
        const info = data as SupplierInfo;
        return {
          nome,
          vendedor: info.vendedor,
          whatsapp: info.whatsapp,
          forma_pagamento: info.formaPagamento,
          dinamica_entrega: info.dinamicaEntrega,
          orcamento_planejado: info.orcamentoPlanejado
        };
      });
      if (fornecedoresArray.length > 0) {
        const { error: supError } = await supabase.from('fornecedores').upsert(fornecedoresArray, { onConflict: 'nome' });
        if (supError) throw supError;
        console.log("Fornecedores sincronizados.");
      }

      // 3. Sincronizar Produtos
      if (consolidatedProducts.length > 0) {
        const produtosData = consolidatedProducts.map(p => ({
          ean: p.ean,
          produto: p.produto,
          categoria: p.categoria,
          markup: p.markup,
          venda: p.venda,
          melhor_preco: p.melhorPreco,
          custo_medio: p.custoMedio
        }));
        const { error: prodError } = await supabase.from('produtos_consolidados').upsert(produtosData, { onConflict: 'ean' });
        if (prodError) throw prodError;
        console.log("Produtos sincronizados.");
      }

      // 4. Sincronizar Histórico
      const historicoArray = Object.entries(productHistories).flatMap(([ean, history]) => {
        const hList = history as HistoryItem[];
        return hList.map(h => ({
          ean,
          data: h.data,
          fornecedor: h.fornecedor,
          quantidade: h.quantidade,
          valor_unitario: h.valorUnitario
        }));
      });
      if (historicoArray.length > 0) {
        // Como histórico pode ter múltiplos registros pro mesmo EAN/Data/Fornecedor, o upsert ideal precisaria de uma chave composta única.
        // Assumindo que a inserção direta serve se não houver chave primária estrita além de um ID gerado.
        const { error: histError } = await supabase.from('historico_compras').upsert(historicoArray);
        if (histError) throw histError;
        console.log("Histórico sincronizado.");
      }

      console.log("Nuvem Atualizada");
      console.log("Sincronização concluída! Verifique seu painel do Supabase.");
      setSyncStatus('synced');
    } catch (error) {
      console.error("Erro na sincronização:", error);
      // Aviso discreto no console em vez de alert
      console.log("Falha ao sincronizar com a nuvem. Verifique sua conexão ou console.");
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Gatilho automático de syncToCloud rodando silenciosamente no background
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Evita sincronizar se estiver vazio na inicialização
      if (categories.length > 0 || consolidatedProducts.length > 0) {
        syncToCloud();
      }
    }, 10000); // 10 segundos de debounce para não sobrecarregar
    return () => clearTimeout(timeoutId);
  }, [categories, consolidatedProducts, productHistories, suppliersData]);

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

  const opportunityCount = 0;
  const attentionCount = 0;

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    Object.values(productHistories).forEach((history: any) => {
      if (Array.isArray(history)) {
        history.forEach((item: any) => {
          if (item.fornecedor) {
            suppliers.add(item.fornecedor);
          }
        });
      }
    });
    return Array.from(suppliers).sort();
  }, [productHistories]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-brand-purple text-white pt-6 px-4 shadow-lg">
        <div className={`mx-auto flex items-center gap-3 flex-nowrap mb-6 ${view === 'summary' || view === 'suppliers' ? 'max-w-full px-4 md:px-10' : 'max-w-5xl'}`}>
          <div className="bg-white/20 p-2 rounded-lg shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate uppercase">
            {view === 'validation' ? 'Validando Importação' : 'Gestor de Compras - XML'}
          </h1>

          <div className="ml-auto flex items-center gap-4">
            <div 
              title={syncStatus === 'synced' ? 'Online e Conectado' : syncStatus === 'error' ? 'Erro de conexão' : 'Verificando...'}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
              syncStatus === 'synced' ? 'bg-green-500/20' : 
              syncStatus === 'error' ? 'bg-red-500/20' : 
              'bg-gray-500/20'
            }`}>
              <Cloud className={`w-4 h-4 ${
                syncStatus === 'synced' ? 'text-green-400' : 
                syncStatus === 'error' ? 'text-red-400' : 
                'text-gray-400 animate-pulse'
              }`} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {(view === 'summary' || view === 'suppliers') && (
          <div className="max-w-full mx-auto px-0 md:px-10 flex justify-around md:justify-start md:gap-8">
            <button
              onClick={() => setView('summary')}
              className={`py-4 md:py-4 text-xs md:text-sm font-black uppercase tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 w-full md:w-auto min-h-[48px] ${
                view === 'summary' ? 'border-white text-white bg-white/10' : 'border-transparent text-white/40 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-6 h-6 md:w-4 md:h-4" />
              <span className="hidden md:inline">Gestão de Preços</span>
            </button>
            <button
              onClick={() => setView('suppliers')}
              className={`py-4 md:py-4 text-xs md:text-sm font-black uppercase tracking-widest transition-all border-b-4 flex items-center justify-center gap-2 w-full md:w-auto min-h-[48px] ${
                view === 'suppliers' ? 'border-white text-white bg-white/10' : 'border-transparent text-white/40 hover:text-white'
              }`}
            >
              <Users className="w-6 h-6 md:w-4 md:h-4" />
              <span className="hidden md:inline">Fornecedores</span>
            </button>
          </div>
        )}
      </header>

      <main className={`w-full mx-auto px-3 py-6 md:p-8 ${view === 'summary' || view === 'suppliers' ? 'max-w-[98%]' : 'max-w-5xl'}`}>
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
                  {consolidatedProducts.length > 0 && (
                    <div className="mb-6 flex justify-end">
                      <button 
                        onClick={() => setView('summary')}
                        className="text-brand-purple font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:underline"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Gestão
                      </button>
                    </div>
                  )}
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
              <div className="flex gap-4">
                <button 
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="text-gray-500 font-bold text-sm hover:underline flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>
                <button 
                  onClick={skipToSummary}
                  className="text-brand-purple font-bold text-sm hover:underline flex items-center gap-2"
                >
                  Finalizar e Ver Resumo
                  <X className="w-4 h-4 rotate-45" />
                </button>
              </div>

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
          ) : view === 'suppliers' ? (
            <motion.div
              key="suppliers-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full px-2 md:px-0 mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-brand-purple p-6 md:p-8 text-white">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Fornecedores Mapeados</h2>
                  <p className="text-brand-purple-light text-sm font-medium opacity-80">
                    Lista de fornecedores extraídos dos XMLs
                  </p>
                </div>
                
                <div className="p-0">
                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome do Fornecedor</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendedor</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pagamento</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Orçamento</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {uniqueSuppliers.map((supplier) => {
                          const data = suppliersData[supplier];
                          const cleanPhone = data?.whatsapp?.replace(/\D/g, '');
                          const budget = data?.orcamentoPlanejado || 0;
                          return (
                            <tr key={supplier} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-gray-800 text-sm uppercase">{supplier}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-600">{data?.vendedor || '-'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-brand-purple uppercase">{data?.formaPagamento || '-'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Wallet className="w-3.5 h-3.5 text-brand-purple opacity-50" />
                                  <span className="text-sm font-black text-gray-700">
                                    {budget > 0 
                                      ? `R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                      : 'R$ 0,00'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-3">
                                  {cleanPhone && (
                                    <a
                                      href={`https://wa.me/55${cleanPhone}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-all shadow-lg shadow-green-500/20"
                                      title="Abrir WhatsApp"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </a>
                                  )}
                                  <button 
                                    onClick={() => {
                                      setSelectedSupplier(supplier);
                                      setSupplierModalOpen(true);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 hover:bg-brand-purple hover:text-white flex items-center justify-center transition-all"
                                    title="Editar Configurações"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    className="text-brand-purple hover:underline text-[10px] font-black uppercase tracking-widest"
                                    onClick={() => {
                                      setSearchTerm(supplier);
                                      setView('summary');
                                    }}
                                  >
                                    Produtos
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden p-3 space-y-4 bg-gray-50/50">
                    {uniqueSuppliers.map((supplier) => {
                      const data = suppliersData[supplier];
                      const cleanPhone = data?.whatsapp?.replace(/\D/g, '');
                      const budget = data?.orcamentoPlanejado || 0;
                      return (
                        <div key={supplier} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
                          {/* Top: Name */}
                          <div>
                            <h3 className="font-black text-gray-800 text-sm uppercase leading-tight">{supplier}</h3>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-brand-purple/5 text-brand-purple text-[9px] font-black uppercase tracking-widest rounded">
                              {data?.formaPagamento || 'Pagamento não definido'}
                            </span>
                          </div>

                          {/* Middle: Seller and Budget */}
                          <div className="grid grid-cols-2 gap-3 py-3 border-y border-gray-50">
                            <div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vendedor</span>
                              <p className="text-xs text-gray-600 font-bold truncate">{data?.vendedor || '-'}</p>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Orçamento</span>
                              <div className="flex items-center gap-1">
                                <Wallet className="w-3 h-3 text-brand-purple opacity-50" />
                                <p className="text-xs font-black text-gray-800">
                                  {budget > 0 
                                    ? `R$ ${budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                    : 'R$ 0,00'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Base: Actions */}
                          <div className="flex gap-2">
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center gap-2 hover:bg-green-600 transition-all font-black uppercase text-[9px] tracking-widest shadow-lg shadow-green-500/20"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            )}
                            <button 
                              onClick={() => {
                                setSelectedSupplier(supplier);
                                setSupplierModalOpen(true);
                              }}
                              className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 hover:bg-brand-purple hover:text-white flex items-center justify-center gap-2 transition-all font-black uppercase text-[9px] tracking-widest"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button 
                              className="w-10 h-10 rounded-xl bg-brand-purple/10 text-brand-purple flex items-center justify-center hover:bg-brand-purple hover:text-white transition-all"
                              onClick={() => {
                                setSearchTerm(supplier);
                                setView('summary');
                              }}
                            >
                              <LayoutDashboard className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {uniqueSuppliers.length === 0 && (
                    <div className="px-6 py-12 text-center text-gray-400 font-medium">
                      Nenhum fornecedor encontrado nos históricos.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="summary-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-full"
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
                        className="flex-1 bg-white/10 hover:bg-white/20 px-3 py-2.5 rounded-xl font-bold text-xs transition-all border border-white/20 flex items-center justify-center gap-2"
                      >
                        Exportar CSV
                      </button>
                      <button 
                        onClick={resetApp}
                        className="flex-1 bg-white text-brand-purple px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        Nova Importação
                      </button>
                    </div>
                  </div>

                  {/* Mobile Dashboard Toggle */}
                  <div className="md:hidden mb-6">
                    <button 
                      onClick={() => setIsDashboardExpanded(!isDashboardExpanded)}
                      className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center justify-between hover:bg-white/20 transition-all"
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Resumo da Operação</span>
                        {!isDashboardExpanded && (
                          <p className="text-[10px] font-bold mt-1 text-brand-purple-light">
                            Markup: {markupMedio.toFixed(1)}% | Itens: {consolidatedProducts.length}
                          </p>
                        )}
                      </div>
                      {isDashboardExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  <motion.div
                    initial={false}
                    animate={{ 
                      height: isDashboardExpanded ? 'auto' : '0px',
                      opacity: isDashboardExpanded ? 1 : 0,
                      marginBottom: isDashboardExpanded ? '2rem' : '0rem'
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden md:!h-auto md:!opacity-100 md:!mb-8"
                  >
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
                  </motion.div>

                  {/* Toolbar */}
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/10 p-4 rounded-2xl border border-white/10">
                    <div className="w-full md:w-64 shrink-0">
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition-all appearance-none cursor-pointer"
                      >
                        <option value="Todas" className="text-gray-900">Filtrar por Categoria: Todas</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat} className="text-gray-900">{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative w-full md:w-96 shrink-0">
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
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {consolidatedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-6 py-12 text-center text-gray-500 font-medium">
                              Nenhum produto encontrado. O banco de dados está pronto para novas importações.
                            </td>
                          </tr>
                        ) : (
                          consolidatedProducts
                            .filter(p => {
                              const matchesSearch = p.produto.toLowerCase().includes(searchTerm.toLowerCase()) || p.ean.includes(searchTerm);
                              const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter;
                              return matchesSearch && matchesCategory;
                            })
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
                                  <div className="flex items-center gap-2">
                                    <select 
                                      value={item.categoria}
                                      onChange={(e) => updateConsolidatedProduct(item.ean, 'categoria', e.target.value)}
                                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-brand-purple outline-none"
                                    >
                                      {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                    </select>
                                    <button 
                                      onClick={() => setCategoryModalOpen(true)}
                                      className="p-1.5 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-md transition-all shrink-0"
                                      title="Gerenciar Categorias"
                                    >
                                      <Settings className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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
                                <td className="px-6 py-4 text-center">
                                  <button 
                                    onClick={() => removeProduct(item.ean)}
                                    className="w-8 h-8 rounded-lg bg-gray-100 text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                                    title="Remover Produto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {consolidatedProducts
                      .filter(p => {
                        const matchesSearch = p.produto.toLowerCase().includes(searchTerm.toLowerCase()) || p.ean.includes(searchTerm);
                        const matchesCategory = categoryFilter === 'Todas' || p.categoria === categoryFilter;
                        return matchesSearch && matchesCategory;
                      })
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
                          <div className="flex items-center gap-2">
                            <select 
                              value={item.categoria}
                              onChange={(e) => updateConsolidatedProduct(item.ean, 'categoria', e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-700"
                            >
                              {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => setCategoryModalOpen(true)}
                              className="p-2.5 bg-gray-50 border border-gray-200 text-gray-400 hover:text-brand-purple rounded-xl transition-all shrink-0"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                          <button 
                            onClick={() => openHistory(item)}
                            className="flex-1 h-12 rounded-xl bg-gray-100 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all text-gray-400"
                          >
                            <HistoryIcon className="w-5 h-5" />
                            HISTÓRICO
                          </button>
                          <button 
                            onClick={() => removeProduct(item.ean)}
                            className="flex-1 h-12 rounded-xl bg-gray-100 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-5 h-5" />
                            DELETAR
                          </button>
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

        {selectedSupplier && (
          <SupplierModal
            isOpen={supplierModalOpen}
            onClose={() => setSupplierModalOpen(false)}
            supplierName={selectedSupplier}
            initialData={suppliersData[selectedSupplier]}
            onSave={(data) => {
              setSuppliersData(prev => ({
                ...prev,
                [selectedSupplier]: data
              }));
              saveToCloud('supplier', { nome: selectedSupplier, ...data });
              setSupplierModalOpen(false);
            }}
          />
        )}

        <CategoryModal 
          isOpen={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
          categories={categories}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
          onClearAll={clearAllData}
        />

        <DeleteConfirmationModal
          isOpen={!!productToDelete}
          onClose={() => setProductToDelete(null)}
          onConfirm={confirmDelete}
          productName={consolidatedProducts.find(p => p.ean === productToDelete)?.produto || ''}
        />
      </main>
    </div>
  );
}
