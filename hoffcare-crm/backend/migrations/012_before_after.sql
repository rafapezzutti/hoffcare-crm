-- Antes e Depois — fotos vinculadas ao paciente
CREATE TABLE IF NOT EXISTS patient_before_after (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  procedure_name VARCHAR(255),
  photo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_type VARCHAR(10) NOT NULL CHECK (photo_type IN ('before', 'after')),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_before_after_patient ON patient_before_after(patient_id);
CREATE INDEX IF NOT EXISTS idx_before_after_clinic ON patient_before_after(clinic_id);
