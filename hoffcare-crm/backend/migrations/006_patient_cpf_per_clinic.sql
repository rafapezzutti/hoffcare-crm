-- Migração 006: CPF de paciente único por clínica (não global)
-- O mesmo paciente pode ser cadastrado em clínicas diferentes.
-- Execute no Neon SQL Editor

-- Remove o índice UNIQUE global de CPF
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;

-- Adiciona constraint composta: CPF único dentro da mesma clínica
ALTER TABLE patients ADD CONSTRAINT patients_cpf_clinic_unique UNIQUE (cpf, clinic_id);
