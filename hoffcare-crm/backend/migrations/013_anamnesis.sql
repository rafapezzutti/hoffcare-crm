-- Anamnese Digital
CREATE TABLE IF NOT EXISTS patient_anamnesis (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed')),
  specialty VARCHAR(100),
  custom_questions JSONB DEFAULT '[]',
  responses JSONB DEFAULT '{}',
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_patient ON patient_anamnesis(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_token ON patient_anamnesis(token);
