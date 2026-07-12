-- ============================================================
-- MIGRATION: Módulo Financeiro — Parte 4
-- Fluxo operacional de Contas a Receber (Pedido → NF → Boleto):
--   • Vencimento EXATO do boleto no pedido (data_vencimento_pagamento)
--   • PDF do boleto no pedido
--   • Recebimento parcial + saldo em aberto em contas_receber
--   • Origem da conta (pedido_nf / manual / backfill / banco / cnab / webhook / csv)
--   • Observação financeira e status RENEGOCIADO
-- Idempotente e compatível com registros antigos.
-- ============================================================

-- 1) Pedidos: vencimento exato do boleto + PDF do boleto
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_vencimento_pagamento DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS boleto_url TEXT;

-- 2) Contas a receber: recebimento parcial, rastreio e origem
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS valor_recebido DECIMAL(12,2) DEFAULT 0;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS saldo_em_aberto DECIMAL(12,2);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS data_ultimo_recebimento DATE;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS observacao_financeira TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS vendedor_nome TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS boleto_url TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS nf_url TEXT;
-- true quando o vencimento foi CALCULADO pelo prazo (não é a data exata do boleto)
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS vencimento_automatico BOOLEAN DEFAULT false;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

-- 3) Status: adicionar RENEGOCIADO (PARCIAL já existia na constraint original)
ALTER TABLE contas_receber DROP CONSTRAINT IF EXISTS contas_receber_status_check;
ALTER TABLE contas_receber ADD CONSTRAINT contas_receber_status_check
  CHECK (status IN ('PENDENTE','RECEBIDO','ATRASADO','CANCELADO','PARCIAL','RENEGOCIADO'));

-- 4) Origem: restringe aos canais suportados (manual hoje; demais preparam integração futura)
ALTER TABLE contas_receber DROP CONSTRAINT IF EXISTS contas_receber_origem_check;
ALTER TABLE contas_receber ADD CONSTRAINT contas_receber_origem_check
  CHECK (origem IN ('pedido_nf','manual','backfill','banco','cnab','webhook','csv'));

-- 5) Backfill de registros antigos (preserva compatibilidade) --------------
-- 5a) valor_recebido nulo → 0
UPDATE contas_receber SET valor_recebido = 0 WHERE valor_recebido IS NULL;

-- 5b) Contas já RECEBIDAS: valor_recebido = valor, saldo = 0
UPDATE contas_receber
   SET valor_recebido = valor,
       saldo_em_aberto = 0,
       data_ultimo_recebimento = COALESCE(data_ultimo_recebimento, data_recebimento)
 WHERE status = 'RECEBIDO';

-- 5c) Demais contas: saldo = valor - valor_recebido (nunca negativo)
UPDATE contas_receber
   SET saldo_em_aberto = GREATEST(valor - COALESCE(valor_recebido, 0), 0)
 WHERE saldo_em_aberto IS NULL;

-- 5d) Origem das contas antigas: com pedido vinculado = fluxo operacional; sem = manual
UPDATE contas_receber SET origem = 'pedido_nf' WHERE origem IS NULL AND pedido_id IS NOT NULL;
UPDATE contas_receber SET origem = 'manual'    WHERE origem IS NULL AND pedido_id IS NULL;

-- 6) Índices auxiliares (idempotentes)
CREATE INDEX IF NOT EXISTS idx_cr_pedido ON contas_receber(pedido_id);
CREATE INDEX IF NOT EXISTS idx_cr_numero_nf ON contas_receber(numero_nf);
CREATE INDEX IF NOT EXISTS idx_cr_cliente ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cr_origem ON contas_receber(origem);
