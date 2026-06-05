-- 026: Tabela de despesas operacionais
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  category    VARCHAR(60)   NOT NULL,
  description TEXT,
  amount      DECIMAL(10,2) NOT NULL,
  due_date    DATE          NOT NULL,
  paid_date   DATE,
  status      VARCHAR(20)   NOT NULL DEFAULT 'pendente',
  recurrence  VARCHAR(20)   NOT NULL DEFAULT 'none',
  notes       TEXT,
  created_at  TIMESTAMP     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_clinic   ON expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON expenses(due_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);
