-- Aceite/recusa de rotas pelo motorista (2026-05-18)
-- Adiciona duas colunas em rotas para o motorista poder aceitar ou recusar
-- uma rota atribuída pelo comercial sem mudar o schema atual.
--
-- - aceita_em: timestamp do momento em que o motorista clicou em "Aceitar".
--   Enquanto NULL e status='ativa', a rota aparece como PENDENTE para o motorista.
-- - motivo_recusa: texto livre preenchido quando o motorista recusa a rota.
--   Status passa a 'recusada' e os pedidos voltam para NF_EMITIDA pelo client.
--
-- Rode no SQL editor do Supabase. Idempotente.

ALTER TABLE rotas ADD COLUMN IF NOT EXISTS aceita_em TIMESTAMPTZ;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

-- Rotas que já estavam ativas antes desta migration são consideradas aceitas
-- (caso contrário virariam "pendentes" e o motorista veria um falso alerta).
UPDATE rotas
   SET aceita_em = COALESCE(aceita_em, criado_em)
 WHERE status = 'ativa' AND aceita_em IS NULL;
