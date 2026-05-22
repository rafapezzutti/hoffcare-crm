-- Migração 003: Profissionais Autônomos
-- Execute no Neon SQL Editor

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS is_autonomous BOOLEAN DEFAULT false;

-- Índice para listar autônomos rapidamente
CREATE INDEX IF NOT EXISTS idx_clinics_autonomous ON clinics(is_autonomous);
