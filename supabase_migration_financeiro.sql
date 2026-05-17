-- ============================================================
-- MIGRATION: Módulo Financeiro
-- Adiciona setor 'financeiro' + tabelas de contas a pagar,
-- contas a receber, reembolsos e categorias de despesa.
-- ============================================================

-- 1) Novo setor 'financeiro' em usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_setor_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_setor_check
  CHECK (setor IN ('admin','comercial','galpao','motorista','vendedor','manutencao','financeiro'));

-- 2) Tabela de categorias de despesa
CREATE TABLE IF NOT EXISTS categorias_despesa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fornecedor','salario','infra','veiculo','imposto','operacional','obra','reembolso','outros')),
  cor TEXT DEFAULT '#64748B',
  icone TEXT DEFAULT '💵',
  ativo BOOLEAN DEFAULT true
);

-- 3) Tabela de despesas (contas a pagar)
CREATE TABLE IF NOT EXISTS despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias_despesa(id),
  categoria_tipo TEXT,
  valor DECIMAL(12,2) NOT NULL,
  fornecedor TEXT,
  cnpj_fornecedor TEXT,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('boleto','pix','transferencia','cartao','dinheiro','cheque')),
  numero_documento TEXT,
  anexo_url TEXT,
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','ATRASADO','CANCELADO')),
  observacoes TEXT,
  recorrente BOOLEAN DEFAULT false,
  periodicidade TEXT CHECK (periodicidade IN ('mensal','bimestral','trimestral','semestral','anual')),
  criado_por TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_vencimento ON despesas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);

-- 4) Tabela de reembolsos
CREATE TABLE IF NOT EXISTS reembolsos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  usuario_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_despesa DATE NOT NULL,
  categoria TEXT,
  comprovante_url TEXT,
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','APROVADO','REEMBOLSADO','RECUSADO')),
  data_aprovacao TIMESTAMPTZ,
  data_reembolso DATE,
  observacao_aprovador TEXT,
  aprovador_nome TEXT,
  forma_reembolso TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_usuario ON reembolsos(usuario_nome);
CREATE INDEX IF NOT EXISTS idx_reembolsos_status ON reembolsos(status);

-- 5) Tabela de contas a receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id),
  cliente_id UUID REFERENCES clientes(id),
  cliente_nome TEXT NOT NULL,
  numero_nf TEXT,
  valor DECIMAL(12,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('a_vista','boleto','cartao','pix')),
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','RECEBIDO','ATRASADO','CANCELADO','PARCIAL')),
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_vencimento ON contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status ON contas_receber(status);

-- 6) RLS + policies (acesso público — controle é via app)
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reembolsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_despesa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico despesas" ON despesas;
DROP POLICY IF EXISTS "Acesso publico reembolsos" ON reembolsos;
DROP POLICY IF EXISTS "Acesso publico cr" ON contas_receber;
DROP POLICY IF EXISTS "Acesso publico cat_desp" ON categorias_despesa;

CREATE POLICY "Acesso publico despesas" ON despesas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico reembolsos" ON reembolsos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico cr" ON contas_receber FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico cat_desp" ON categorias_despesa FOR ALL USING (true) WITH CHECK (true);

-- 7) Categorias padrão
INSERT INTO categorias_despesa (nome, tipo, cor, icone) VALUES
('Fornecedores', 'fornecedor', '#3B82F6', '📦'),
('Salários e Benefícios', 'salario', '#8B5CF6', '👥'),
('Aluguel e Infraestrutura', 'infra', '#F59E0B', '🏢'),
('Combustível e Veículos', 'veiculo', '#EF4444', '⛽'),
('Impostos (ICMS, PIS, COFINS, INSS)', 'imposto', '#DC2626', '📋'),
('Cartão Corporativo', 'operacional', '#06B6D4', '💳'),
('Obras e Reformas', 'obra', '#84CC16', '🔨'),
('Reembolsos', 'reembolso', '#EC4899', '💸'),
('Outros', 'outros', '#64748B', '💵')
ON CONFLICT DO NOTHING;
