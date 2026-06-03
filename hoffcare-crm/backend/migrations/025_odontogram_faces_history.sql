-- Marcações por face de cada dente
CREATE TABLE IF NOT EXISTS odontogram_tooth_faces (
  id           SERIAL PRIMARY KEY,
  clinic_id    INTEGER NOT NULL,
  patient_id   INTEGER NOT NULL,
  tooth_number VARCHAR(3) NOT NULL,
  face         VARCHAR(2) NOT NULL,  -- V, M, D, L, O (vestibular, mesial, distal, lingual, oclusal/incisal)
  status       VARCHAR(30),          -- cariado | restaurado | selado | fraturado | manchado
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(clinic_id, patient_id, tooth_number, face)
);

-- Histórico de procedimentos realizados por dente
CREATE TABLE IF NOT EXISTS odontogram_tooth_history (
  id                SERIAL PRIMARY KEY,
  clinic_id         INTEGER NOT NULL,
  patient_id        INTEGER NOT NULL,
  tooth_number      VARCHAR(3) NOT NULL,
  procedure_name    VARCHAR(200) NOT NULL,
  procedure_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  professional_name VARCHAR(200),
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooth_faces_patient   ON odontogram_tooth_faces(patient_id, tooth_number);
CREATE INDEX IF NOT EXISTS idx_tooth_history_patient ON odontogram_tooth_history(patient_id, tooth_number);
