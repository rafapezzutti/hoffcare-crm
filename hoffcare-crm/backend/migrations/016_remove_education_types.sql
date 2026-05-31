-- Migration 016: Remover Professor de Educação Física e Professor Particular

-- ─── Migrar registros existentes com os tipos removidos ──────────
-- Profissionais → fallback para 'medico'
UPDATE professionals
   SET type = 'medico'
 WHERE type IN ('professor_educacao_fisica', 'professor_particular');

-- Salas → fallback para 'medico'
UPDATE rooms
   SET type = 'medico'
 WHERE type IN ('professor_educacao_fisica', 'professor_particular');

-- Procedimentos → fallback para 'medico'
UPDATE procedures
   SET type = 'medico'
 WHERE type IN ('professor_educacao_fisica', 'professor_particular');

-- Agendamentos → fallback para 'medico'
UPDATE appointments
   SET type = 'medico'
 WHERE type IN ('professor_educacao_fisica', 'professor_particular');

-- Prontuários → fallback para 'medico'
UPDATE medical_records
   SET type = 'medico'
 WHERE type IN ('professor_educacao_fisica', 'professor_particular');

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
