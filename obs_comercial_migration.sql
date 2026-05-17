-- Observação enviada pelo comercial ao criar/editar o pedido
-- Distinta do campo "obs" usado pelo galpão para rejeição.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS obs_comercial TEXT;
