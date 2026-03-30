-- ============================================================
-- SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL
-- Execute no Supabase SQL Editor
-- Data: 2026-03-30
-- ============================================================

CREATE TABLE IF NOT EXISTS notificacoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_destino TEXT NOT NULL,
  setor_destino   TEXT,
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  pedido_id       UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  lida            BOOLEAN DEFAULT false,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso publico notificacoes"
  ON notificacoes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índice para filtrar por setor rapidamente
CREATE INDEX IF NOT EXISTS notificacoes_setor_idx
  ON notificacoes (setor_destino, lida, criado_em DESC);

CREATE INDEX IF NOT EXISTS notificacoes_usuario_idx
  ON notificacoes (usuario_destino, lida, criado_em DESC);

-- Habilita Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
