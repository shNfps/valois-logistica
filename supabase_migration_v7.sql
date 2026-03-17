-- ============================================================
-- VALOIS LOGÍSTICA — Migração v7
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona campo codigo na tabela pedido_itens
ALTER TABLE public.pedido_itens ADD COLUMN IF NOT EXISTS codigo TEXT;
