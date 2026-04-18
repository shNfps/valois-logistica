-- Migration v11: Tabela de configuração para reset de ranking com data de corte
CREATE TABLE IF NOT EXISTS config_ranking (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data_corte_comercial TIMESTAMPTZ,
  data_corte_vendedor TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE config_ranking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso publico config" ON config_ranking FOR ALL USING (true) WITH CHECK (true);

-- Inserir data de corte do comercial: 16/04/2026 (horário de Brasília)
INSERT INTO config_ranking (id, data_corte_comercial)
VALUES (1, '2026-04-16 00:00:00-03:00')
ON CONFLICT (id) DO UPDATE SET
  data_corte_comercial = '2026-04-16 00:00:00-03:00',
  atualizado_em = NOW();
