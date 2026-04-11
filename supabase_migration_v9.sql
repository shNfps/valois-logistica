-- Migration v9: campo avatar nos usuários
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar TEXT;
