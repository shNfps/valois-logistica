-- ============================================================
-- VALOIS LOGÍSTICA — Migração v2
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona coluna fabricante na tabela produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS fabricante text;
