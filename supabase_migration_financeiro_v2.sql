-- ============================================================
-- MIGRATION: Módulo Financeiro — Parte 2
-- Forma de pagamento em pedidos, fornecedores recorrentes,
-- configuração de alertas e suporte a integração NF → CR.
-- ============================================================

-- 1) Forma de pagamento em pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT 'a_vista';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS prazo_pagamento_dias INT DEFAULT 0;

-- 2) Fornecedores recorrentes (catálogo opcional para autocomplete)
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  categoria_id UUID REFERENCES categorias_despesa(id),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(LOWER(nome));

-- 3) Configurações globais do módulo (id fixo = 1)
CREATE TABLE IF NOT EXISTS config_financeiro (
  id INT PRIMARY KEY DEFAULT 1,
  dias_alerta_vencimento INT DEFAULT 3,
  alertar_inadimplencia BOOLEAN DEFAULT true,
  forma_pagamento_padrao TEXT DEFAULT 'a_vista',
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO config_financeiro (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4) Marcador de notificações já disparadas (anti-duplicação por dia)
CREATE TABLE IF NOT EXISTS alertas_financeiro_disparados (
  chave TEXT PRIMARY KEY,
  disparado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5) RLS + policies
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_financeiro_disparados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Acesso publico config_fin" ON config_financeiro;
DROP POLICY IF EXISTS "Acesso publico alertas_disp" ON alertas_financeiro_disparados;

CREATE POLICY "Acesso publico fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico config_fin" ON config_financeiro FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico alertas_disp" ON alertas_financeiro_disparados FOR ALL USING (true) WITH CHECK (true);
