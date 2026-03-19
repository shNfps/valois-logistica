-- ============================================================
-- CORREÇÕES DO BANCO - VALOIS LOGÍSTICA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. REMOVER PRODUTOS DUPLICADOS
--    Mantém o produto com MAIOR preço quando há nomes iguais
-- ────────────────────────────────────────────────────────────

DELETE FROM produtos a
USING produtos b
WHERE a.id < b.id
  AND LOWER(a.nome) = LOWER(b.nome)
  AND a.preco <= b.preco;

-- ────────────────────────────────────────────────────────────
-- 2. REMOVER PONTOS DOS CÓDIGOS DE PRODUTO
-- ────────────────────────────────────────────────────────────

-- Na tabela produtos
UPDATE produtos
SET codigo = REPLACE(codigo, '.', '')
WHERE codigo LIKE '%.%';

-- Na tabela pedido_itens
UPDATE pedido_itens
SET codigo = REPLACE(codigo, '.', '')
WHERE codigo IS NOT NULL
  AND codigo LIKE '%.%';

-- ────────────────────────────────────────────────────────────
-- 3. LISTAR PRODUTOS SEM CÓDIGO (somente consulta — não deleta)
--    Execute para ver quais produtos precisam de código
-- ────────────────────────────────────────────────────────────

SELECT id, nome, categoria, preco
FROM produtos
WHERE codigo IS NULL OR codigo = ''
ORDER BY categoria, nome;
