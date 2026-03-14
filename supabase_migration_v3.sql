-- ============================================================
-- VALOIS LOGÍSTICA — Migração v3
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona coluna documento (CPF/CNPJ somente números) na tabela clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS documento text;

-- Índice único: não permite dois clientes com o mesmo CPF/CNPJ
-- (ignora NULLs — clientes sem documento podem existir sem restrição)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_documento_unique
  ON public.clientes (documento)
  WHERE documento IS NOT NULL;
