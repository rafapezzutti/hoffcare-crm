-- Odontograma por paciente (numeração FDI)
CREATE TABLE IF NOT EXISTS odontogram_teeth (
  id               SERIAL PRIMARY KEY,
  clinic_id        INTEGER NOT NULL,
  patient_id       INTEGER NOT NULL,
  tooth_number     VARCHAR(3) NOT NULL,   -- FDI: 11-18, 21-28, 31-38, 41-48
  status           VARCHAR(50),           -- higido | cariado | restaurado | ausente | implante | coroa | canal | fraturado | extracao
  procedure_name   VARCHAR(200),          -- procedimento planejado
  procedure_value  DECIMAL(10,2),         -- custo estimado
  notes            TEXT,                  -- observação livre
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(clinic_id, patient_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_odontogram_patient ON odontogram_teeth(patient_id);
CREATE INDEX IF NOT EXISTS idx_odontogram_clinic  ON odontogram_teeth(clinic_id);
