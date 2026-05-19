-- Corrige inconsistência: pedidos vinculados a rotas ativas que ficaram em NF_EMITIDA
-- (o builder de roteiro cria o vínculo em rota_pedidos e depois atualiza o status do
-- pedido em loop não-transacional; se uma das updates falhar silenciosamente, o vínculo
-- fica sem o status correspondente e o card do motorista esconde o pedido).

-- Diagnóstico — lista pedidos que estão vinculados a uma rota ativa mas com status divergente
SELECT r.id AS rota_id, r.numero_roteiro, r.motorista_nome, p.id AS pedido_id,
       p.numero_ref, p.cliente, p.status
FROM rota_pedidos rp
JOIN rotas r ON r.id = rp.rota_id
JOIN pedidos p ON p.id = rp.pedido_id
WHERE r.status = 'ativa'
  AND p.status NOT IN ('EM_ROTA', 'ENTREGUE')
ORDER BY r.criado_em DESC, p.numero_ref;

-- Correção — promove pra EM_ROTA todo pedido vinculado a rota ativa que ainda não foi entregue
UPDATE pedidos SET status = 'EM_ROTA'
WHERE id IN (
  SELECT rp.pedido_id
  FROM rota_pedidos rp
  JOIN rotas r ON r.id = rp.rota_id
  WHERE r.status = 'ativa'
) AND status <> 'ENTREGUE';
