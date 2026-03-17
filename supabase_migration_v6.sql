-- ============================================================
-- VALOIS LOGÍSTICA — Migração v6
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Adiciona campo cidades (array) na tabela rotas
-- Mantém o campo cidade (TEXT) para compatibilidade retroativa
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS cidades TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Popula cidades com o valor atual de cidade nas rotas existentes
UPDATE public.rotas SET cidades = ARRAY[cidade] WHERE cidade IS NOT NULL AND (cidades IS NULL OR array_length(cidades, 1) IS NULL);
