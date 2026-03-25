-- Adiciona coluna numero_nf na tabela pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_nf TEXT;
