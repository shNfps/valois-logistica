-- Roteiros de entrega: extensões à tabela rotas existente
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS numero_roteiro TEXT;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS distancia_km NUMERIC;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS duracao_min INTEGER;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS ordem_pedidos JSONB;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS criado_por TEXT;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS data_roteiro DATE;

-- Veículos: permitir fiorino e caminhao
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_veiculo_check;
ALTER TABLE rotas ADD CONSTRAINT rotas_veiculo_check
  CHECK (veiculo IN ('van','kombi','carro','moto','fiorino','caminhao'));

-- Status: incluir rascunho / confirmada / em_andamento
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_status_check;
ALTER TABLE rotas ADD CONSTRAINT rotas_status_check
  CHECK (status IN ('rascunho','ativa','confirmada','em_andamento','finalizada'));

CREATE INDEX IF NOT EXISTS idx_rotas_numero ON rotas(numero_roteiro);
CREATE INDEX IF NOT EXISTS idx_rotas_data ON rotas(data_roteiro);
