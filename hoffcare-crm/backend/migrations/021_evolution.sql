-- Evolução Clínica por paciente
CREATE TABLE IF NOT EXISTS clinical_evolutions (
  id                SERIAL PRIMARY KEY,
  clinic_id         INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_name VARCHAR(200),
  note              TEXT NOT NULL,
  images            JSONB NOT NULL DEFAULT '[]',
  evolution_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolution_patient ON clinical_evolutions(patient_id);
CREATE INDEX IF NOT EXISTS idx_evolution_clinic  ON clinical_evolutions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_evolution_date    ON clinical_evolutions(evolution_date DESC);
