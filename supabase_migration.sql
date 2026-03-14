-- ============================================================
-- VALOIS LOGÍSTICA — Migração do banco de dados
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela: clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       text NOT NULL,
  cidade     text,
  telefone   text,
  email      text,
  criado_em  timestamptz DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_all" ON public.clientes
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 2. Tabela: pedido_itens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id       uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  nome_produto    text NOT NULL,
  quantidade      numeric DEFAULT 0,
  unidade         text DEFAULT 'un',
  preco_unitario  numeric DEFAULT 0,
  preco_total     numeric DEFAULT 0,
  criado_em       timestamptz DEFAULT now()
);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_itens_all" ON public.pedido_itens
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS pedido_itens_pedido_id_idx
  ON public.pedido_itens (pedido_id);

-- ------------------------------------------------------------
-- 3. Coluna valor_total na tabela pedidos
-- ------------------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0;

-- ------------------------------------------------------------
-- Variável de ambiente necessária no .env do projeto:
--   VITE_ANTHROPIC_API_KEY=sk-ant-...
-- ------------------------------------------------------------
