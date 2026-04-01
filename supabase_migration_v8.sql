-- ============================================================
-- Migration v8: Vendedores, Comissões e Metas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar campo vendedor_nome na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vendedor_nome TEXT DEFAULT 'Valois';

-- Preencher clientes existentes sem vendedor com 'Valois'
UPDATE clientes SET vendedor_nome = 'Valois' WHERE vendedor_nome IS NULL OR vendedor_nome = '';

-- 2. Criar tabela de metas
CREATE TABLE IF NOT EXISTS metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('semanal','mensal')),
  valor_meta DECIMAL(10,2) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  vendedor_nome TEXT, -- NULL = meta geral (vale pra todos)
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;

-- Verifica se a policy já existe antes de criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'metas' AND policyname = 'Acesso publico metas'
  ) THEN
    EXECUTE 'CREATE POLICY "Acesso publico metas" ON metas FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;
