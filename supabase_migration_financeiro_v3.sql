-- ============================================================
-- MIGRATION: Módulo Financeiro — Parte 3 (DRE)
-- Adiciona custo aos produtos, taxas de impostos configuráveis
-- e taxa de comissão para cálculo automático.
-- ============================================================

-- 1) Custo dos produtos (base do CMV)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS custo DECIMAL(10,2) DEFAULT 0;

-- 2) Snapshot de custo nos itens vendidos (preserva margem histórica
--    mesmo se o custo do produto mudar depois).
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS custo_unitario DECIMAL(10,2);

-- 3) Taxas configuráveis no DRE
ALTER TABLE config_financeiro ADD COLUMN IF NOT EXISTS taxa_imposto_venda DECIMAL(5,2) DEFAULT 12.00;
ALTER TABLE config_financeiro ADD COLUMN IF NOT EXISTS taxa_imposto_lucro DECIMAL(5,2) DEFAULT 6.00;
ALTER TABLE config_financeiro ADD COLUMN IF NOT EXISTS taxa_comissao DECIMAL(5,2) DEFAULT 5.00;
ALTER TABLE config_financeiro ADD COLUMN IF NOT EXISTS dre_visao TEXT DEFAULT 'completo' CHECK (dre_visao IN ('simplificado','completo'));
