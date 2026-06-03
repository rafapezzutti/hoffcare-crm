-- Migration 017: Tornar birthdate opcional em patients
-- Necessário para suportar importação em lote sem data de nascimento

ALTER TABLE patients ALTER COLUMN birthdate DROP NOT NULL;
