-- Controle Antropométrico / Evolução Física
CREATE TABLE IF NOT EXISTS patient_anthropometry (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  eval_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL(5,2),       -- kg
  height DECIMAL(5,2),       -- cm
  imc DECIMAL(5,2),          -- calculado
  body_fat_pct DECIMAL(5,2), -- % gordura corporal (PGC)
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anthropometry_patient ON patient_anthropometry(patient_id);
