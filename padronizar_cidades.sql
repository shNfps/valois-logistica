-- Padronização da lista de cidades atendidas pela Valois (2026-05-18)
--
-- 1. Verifica se Saquarema ainda tem clientes/pedidos no banco antes de removê-la do frontend.
-- 2. Renomeia "São Pedro" para "São Pedro da Aldeia" em pedidos e clientes (sem DELETE).
-- 3. Não toca em nenhum dado fora desses dois ajustes.
--
-- Rode este arquivo no SQL editor do Supabase. Cada bloco é independente.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Verificação Saquarema (resultado esperado: 0 / 0 antes de remover do frontend)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM clientes WHERE cidade = 'Saquarema') AS clientes_saquarema,
  (SELECT COUNT(*) FROM pedidos  WHERE cidade = 'Saquarema') AS pedidos_saquarema;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Verificação São Pedro → São Pedro da Aldeia (quantas linhas serão renomeadas)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM clientes WHERE cidade = 'São Pedro') AS clientes_sao_pedro,
  (SELECT COUNT(*) FROM pedidos  WHERE cidade = 'São Pedro') AS pedidos_sao_pedro;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Padronização do nome — execute em uma transação
-- ────────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE pedidos
   SET cidade = 'São Pedro da Aldeia'
 WHERE cidade = 'São Pedro';

UPDATE clientes
   SET cidade = 'São Pedro da Aldeia'
 WHERE cidade = 'São Pedro';

-- Confirme que a contagem da etapa 2 bateu antes de COMMIT.
COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Conferência pós-update
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM clientes WHERE cidade = 'São Pedro')          AS clientes_sao_pedro_restantes,
  (SELECT COUNT(*) FROM pedidos  WHERE cidade = 'São Pedro')          AS pedidos_sao_pedro_restantes,
  (SELECT COUNT(*) FROM clientes WHERE cidade = 'São Pedro da Aldeia') AS clientes_sao_pedro_aldeia,
  (SELECT COUNT(*) FROM pedidos  WHERE cidade = 'São Pedro da Aldeia') AS pedidos_sao_pedro_aldeia;
