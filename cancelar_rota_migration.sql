-- Cancelamento de rotas ativas pelo admin/comercial (2026-05-19)
-- Adiciona o status 'cancelada' (e 'recusada', que já era usado pelo client)
-- ao check constraint da tabela rotas. Idempotente.

ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_status_check;
ALTER TABLE rotas ADD CONSTRAINT rotas_status_check
  CHECK (status IN ('rascunho','ativa','confirmada','em_andamento','finalizada','recusada','cancelada'));
