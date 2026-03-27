-- SQL Schema para o Supabase

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL
);

-- Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  nome TEXT PRIMARY KEY,
  vendedor TEXT,
  whatsapp TEXT,
  forma_pagamento TEXT,
  dinamica_entrega TEXT,
  orcamento_planejado NUMERIC(10, 2)
);

-- Tabela de Produtos Consolidados
CREATE TABLE IF NOT EXISTS produtos_consolidados (
  ean TEXT PRIMARY KEY,
  produto TEXT NOT NULL,
  categoria TEXT REFERENCES categorias(nome) ON UPDATE CASCADE,
  markup NUMERIC(10, 2),
  venda NUMERIC(10, 2),
  melhor_preco NUMERIC(10, 2),
  custo_medio NUMERIC(10, 2)
);

-- Tabela de Histórico de Compras
CREATE TABLE IF NOT EXISTS historico_compras (
  id BIGSERIAL PRIMARY KEY,
  ean TEXT REFERENCES produtos_consolidados(ean) ON DELETE CASCADE,
  data TIMESTAMP WITH TIME ZONE NOT NULL,
  fornecedor TEXT,
  quantidade NUMERIC(10, 2),
  valor_unitario NUMERIC(10, 2)
);

-- Habilitar RLS (Opcional, mas recomendado)
-- ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE produtos_consolidados ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE historico_compras ENABLE ROW LEVEL SECURITY;

-- Exemplo de política de acesso público (Ajustar conforme necessário)
-- CREATE POLICY "Acesso Público" ON categorias FOR ALL USING (true);
-- CREATE POLICY "Acesso Público" ON fornecedores FOR ALL USING (true);
-- CREATE POLICY "Acesso Público" ON produtos_consolidados FOR ALL USING (true);
-- CREATE POLICY "Acesso Público" ON historico_compras FOR ALL USING (true);
