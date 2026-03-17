-- ============================================================
-- VALOIS LOGÍSTICA — Migração v5
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Campos novos na tabela produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS diluicao TEXT;

-- Índice para busca por código de produto
CREATE INDEX IF NOT EXISTS produtos_codigo_idx ON public.produtos (codigo) WHERE codigo IS NOT NULL;

-- Campos novos na tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Índice para busca por CNPJ
CREATE INDEX IF NOT EXISTS clientes_cnpj_idx ON public.clientes (cnpj) WHERE cnpj IS NOT NULL;
