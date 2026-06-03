-- Templates de perguntas de anamnese por clínica
CREATE TABLE IF NOT EXISTS anamnesis_templates (
  id         SERIAL PRIMARY KEY,
  clinic_id  INTEGER NOT NULL,
  name       VARCHAR(200) NOT NULL,
  questions  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_templates_clinic ON anamnesis_templates(clinic_id);
