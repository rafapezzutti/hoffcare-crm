-- Migration 011: Reaplicar constraints de tipo para incluir novos tipos
-- (009 foi registrada mas nunca executada devido a erro anterior no runner)

-- ─── professionals ───────────────────────────────────────────────
ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_type_check;
ALTER TABLE professionals ADD CONSTRAINT professionals_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista',
    'professor_educacao_fisica', 'professor_particular'
  ));

-- ─── rooms ───────────────────────────────────────────────────────
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista',
    'professor_educacao_fisica', 'professor_particular'
  ));

-- ─── procedures ──────────────────────────────────────────────────
ALTER TABLE procedures DROP CONSTRAINT IF EXISTS procedures_type_check;
ALTER TABLE procedures ADD CONSTRAINT procedures_type_check
  CHECK (type IN (
    'medico', 'odontologico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista',
    'professor_educacao_fisica', 'professor_particular'
  ));

-- ─── appointments ────────────────────────────────────────────────
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_type_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista',
    'professor_educacao_fisica', 'professor_particular'
  ));

-- ─── medical_records ─────────────────────────────────────────────
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_type_check;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_type_check
  CHECK (type IN (
    'medico', 'dentista',
    'fisioterapeuta', 'psicologo', 'nutricionista', 'fonoaudiologo',
    'terapeuta_ocupacional', 'enfermeiro', 'biomedico',
    'farmaceutico', 'quiropraxista', 'esteticista',
    'professor_educacao_fisica', 'professor_particular'
  ));
