-- v9: Tabela de logs para extração em lote com IA
CREATE TABLE IF NOT EXISTS extracao_lote_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  iniciado_em TIMESTAMPTZ DEFAULT NOW(),
  concluido_em TIMESTAMPTZ,
  total_pedidos INTEGER,
  sucesso INTEGER,
  falhas INTEGER,
  novos_produtos INTEGER,
  iniciado_por TEXT,
  detalhes JSONB
);

ALTER TABLE extracao_lote_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso publico extracao logs" ON extracao_lote_logs FOR ALL USING (true) WITH CHECK (true);
