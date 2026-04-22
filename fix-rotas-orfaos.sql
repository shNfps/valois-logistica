-- ============================================================
-- FIX: Diagnóstico e correção de rotas com pedidos órfãos
-- Data: 2026-04-22
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. DIAGNÓSTICO: Rotas ativas com detalhes de pedidos
-- ═══════════════════════════════════════════════════════════
SELECT
  r.id AS rota_id,
  r.motorista_nome,
  r.status AS rota_status,
  r.criado_em,
  rp.pedido_id,
  p.status AS pedido_status,
  CASE WHEN p.id IS NULL THEN '⚠️ ÓRFÃO (deletado)' ELSE '✅ Existe' END AS pedido_existe
FROM rotas r
JOIN rota_pedidos rp ON rp.rota_id = r.id
LEFT JOIN pedidos p ON p.id = rp.pedido_id
WHERE r.status = 'ativa'
ORDER BY r.motorista_nome, r.criado_em DESC, p.status;

-- ═══════════════════════════════════════════════════════════
-- 2. DIAGNÓSTICO: Resumo por rota (contagem entregues vs total)
-- ═══════════════════════════════════════════════════════════
SELECT
  r.id AS rota_id,
  r.motorista_nome,
  COUNT(rp.pedido_id) AS total_vinculos,
  COUNT(p.id) AS pedidos_existentes,
  COUNT(rp.pedido_id) - COUNT(p.id) AS pedidos_orfaos,
  COUNT(CASE WHEN p.status = 'ENTREGUE' THEN 1 END) AS entregues,
  COUNT(CASE WHEN p.status = 'EM_ROTA' THEN 1 END) AS em_rota,
  COUNT(CASE WHEN p.status NOT IN ('ENTREGUE', 'EM_ROTA') AND p.id IS NOT NULL THEN 1 END) AS outros_status
FROM rotas r
JOIN rota_pedidos rp ON rp.rota_id = r.id
LEFT JOIN pedidos p ON p.id = rp.pedido_id
WHERE r.status = 'ativa'
GROUP BY r.id, r.motorista_nome
ORDER BY r.motorista_nome;

-- ═══════════════════════════════════════════════════════════
-- 3. LIMPEZA: Remover vínculos rota_pedidos órfãos (pedido deletado)
-- ═══════════════════════════════════════════════════════════
DELETE FROM rota_pedidos
WHERE pedido_id NOT IN (SELECT id FROM pedidos);

-- ═══════════════════════════════════════════════════════════
-- 4. FORÇAR FINALIZAÇÃO: Rotas onde todos os pedidos existentes estão ENTREGUE
-- ═══════════════════════════════════════════════════════════
UPDATE rotas SET status = 'finalizada'
WHERE id IN (
  SELECT r.id FROM rotas r
  WHERE r.status = 'ativa'
  AND EXISTS (SELECT 1 FROM rota_pedidos rp WHERE rp.rota_id = r.id)
  AND NOT EXISTS (
    SELECT 1 FROM rota_pedidos rp
    JOIN pedidos p ON p.id = rp.pedido_id
    WHERE rp.rota_id = r.id AND p.status != 'ENTREGUE'
  )
);

-- ═══════════════════════════════════════════════════════════
-- 5. FINALIZAR rotas ativas SEM nenhum pedido vinculado
-- ═══════════════════════════════════════════════════════════
UPDATE rotas SET status = 'finalizada'
WHERE status = 'ativa'
AND NOT EXISTS (SELECT 1 FROM rota_pedidos rp WHERE rp.rota_id = rotas.id);
