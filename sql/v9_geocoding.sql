-- v9: Adicionar coordenadas geográficas aos clientes para mapa de equipamentos
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);

-- Índice para queries de mapa
CREATE INDEX IF NOT EXISTS idx_clientes_coords ON clientes (latitude, longitude) WHERE latitude IS NOT NULL;
