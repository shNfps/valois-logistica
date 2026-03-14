-- ============================================================
-- VALOIS LOGÍSTICA — Migração v4
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Vincula pedidos à tabela clientes via FK
-- SET NULL: se o cliente for deletado, o pedido mantém o nome mas perde o vínculo
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedidos_cliente_id_idx
  ON public.pedidos (cliente_id)
  WHERE cliente_id IS NOT NULL;
