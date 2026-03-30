-- ============================================================
-- REAJUSTE IMEDIATO DE 5% EM TODOS OS PRODUTOS
-- Execute no Supabase SQL Editor
-- Data: 2026-03-30
-- ============================================================

-- Prévia: quantos produtos serão afetados e preço médio atual
SELECT
  COUNT(*)            AS total_produtos,
  ROUND(AVG(preco), 2) AS preco_medio_atual,
  ROUND(AVG(preco) * 1.05, 2) AS preco_medio_novo
FROM produtos;

-- Aplica o reajuste de 5%
UPDATE produtos
SET preco = ROUND(preco * 1.05, 2);

-- Confirmação: verifique o resultado
SELECT id, nome, categoria, preco
FROM produtos
ORDER BY categoria, nome;
