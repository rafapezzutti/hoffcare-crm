-- Migração 004: Nacionalidade do Profissional
-- Permite cadastrar profissionais autônomos estrangeiros (sem CPF/CRO obrigatórios)
-- Execute no Neon SQL Editor

-- 1. Adiciona coluna de nacionalidade (padrão: brasileiro)
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(20) NOT NULL DEFAULT 'brasileiro'
  CHECK (nationality IN ('brasileiro', 'estrangeiro'));

-- 2. Torna CPF e CRM/CRO opcionais (necessário para estrangeiros)
--    A constraint UNIQUE em CPF é mantida; no PostgreSQL,
--    múltiplos NULLs são permitidos em colunas UNIQUE.
ALTER TABLE professionals
  ALTER COLUMN cpf DROP NOT NULL;

ALTER TABLE professionals
  ALTER COLUMN crm_cro DROP NOT NULL;

-- 3. Índice opcional para filtros por nacionalidade
CREATE INDEX IF NOT EXISTS idx_professionals_nationality ON professionals(nationality);
