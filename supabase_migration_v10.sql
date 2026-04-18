-- Migration v10: Coordenadas geográficas nos clientes para mapa de equipamentos
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);

-- Índice para queries de mapa (só indexa clientes com coordenadas)
CREATE INDEX IF NOT EXISTS idx_clientes_coords ON clientes (latitude, longitude) WHERE latitude IS NOT NULL;
