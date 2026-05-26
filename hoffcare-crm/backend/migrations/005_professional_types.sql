-- Migração 005: Expandir tipos de profissionais de saúde
-- Execute no Neon SQL Editor
-- Adiciona: Fisioterapeuta, Psicólogo, Nutricionista, Fonoaudiólogo, Terapeuta Ocupacional,
--           Enfermeiro, Biomédico, Farmacêutico, Quiropraxista, Esteticista

-- ─── professionals ───────────────────────────────────────────────
ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_type_check;
ALTER TABLE professionals ADD CONSTRAINT professionals_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista'
  ));

-- ─── rooms ───────────────────────────────────────────────────────
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista'
  ));

-- ─── procedures ──────────────────────────────────────────────────
-- Mantém 'odontologico' por compatibilidade com dados existentes
ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_type_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_type_check
  CHECK (type IN (
    'medico', 'odontologico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista'
  ));

-- ─── appointments ────────────────────────────────────────────────
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_type_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista'
  ));

-- ─── medical_records ─────────────────────────────────────────────
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_type_check;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista'
  ));
