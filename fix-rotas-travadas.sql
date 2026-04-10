-- CORREÇÃO IMEDIATA: Finalizar rotas ativas onde todos os pedidos já foram entregues
-- Rode este script no SQL Editor do Supabase

UPDATE rotas SET status = 'finalizada'
WHERE status = 'ativa'
AND id NOT IN (
  SELECT DISTINCT rp.rota_id
  FROM rota_pedidos rp
  JOIN pedidos p ON p.id = rp.pedido_id
  WHERE p.status != 'ENTREGUE'
);

-- Verificação: mostra o que foi afetado (rode antes para conferir)
-- SELECT r.id, r.motorista_nome, r.cidades, r.status,
--   COUNT(rp.pedido_id) as total_pedidos,
--   SUM(CASE WHEN p.status = 'ENTREGUE' THEN 1 ELSE 0 END) as entregues
-- FROM rotas r
-- JOIN rota_pedidos rp ON rp.rota_id = r.id
-- JOIN pedidos p ON p.id = rp.pedido_id
-- WHERE r.status = 'ativa'
-- GROUP BY r.id
-- HAVING COUNT(rp.pedido_id) = SUM(CASE WHEN p.status = 'ENTREGUE' THEN 1 ELSE 0 END);
