-- Migration 010: Aumentar tamanho da coluna type para suportar valores longos
-- 'professor_educacao_fisica' tem 24 chars — VARCHAR(20) era insuficiente

ALTER TABLE professionals   ALTER COLUMN type TYPE VARCHAR(50);
ALTER TABLE rooms           ALTER COLUMN type TYPE VARCHAR(50);
ALTER TABLE procedures      ALTER COLUMN type TYPE VARCHAR(50);
ALTER TABLE appointments    ALTER COLUMN type TYPE VARCHAR(50);
ALTER TABLE medical_records ALTER COLUMN type TYPE VARCHAR(50);
