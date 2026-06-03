-- Orçamentos emitidos pela clínica
CREATE TABLE IF NOT EXISTS budgets (
  id              SERIAL PRIMARY KEY,
  clinic_id       INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  number          VARCHAR(50),
  status          VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  -- rascunho | enviado | aguardando | aceito | declinado | expirado
  valid_until     DATE,
  sent_at         TIMESTAMP,
  notes           TEXT,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Itens do orçamento (procedimentos com valores)
CREATE TABLE IF NOT EXISTS budget_items (
  id              SERIAL PRIMARY KEY,
  budget_id       INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  procedure_id    INTEGER REFERENCES procedures(id) ON DELETE SET NULL,
  procedure_name  VARCHAR(200) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_value      DECIMAL(10,2) NOT NULL,
  total_value     DECIMAL(10,2) NOT NULL
);

-- Sequência para numeração automática de orçamentos
CREATE SEQUENCE IF NOT EXISTS budget_number_seq START 1;

CREATE INDEX IF NOT EXISTS idx_budgets_clinic    ON budgets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_budgets_patient   ON budgets(patient_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status    ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);
