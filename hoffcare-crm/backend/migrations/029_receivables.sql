-- 029: Contas a Receber — forma de pagamento e parcelas
-- Títulos gerados a partir de procedimentos (medical_records) e orçamentos (budgets)

CREATE TABLE IF NOT EXISTS receivables (
  id             SERIAL PRIMARY KEY,
  clinic_id      INTEGER,
  source_type    TEXT    NOT NULL,            -- 'procedimento' | 'orcamento'
  source_id      INTEGER NOT NULL,
  patient_id     INTEGER,
  patient_name   TEXT,
  descricao      TEXT,
  payment_method TEXT    NOT NULL DEFAULT 'pix',  -- pix | debito | credito
  installments   INTEGER NOT NULL DEFAULT 1,      -- 1..12 (sem juros)
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS receivable_parcelas (
  id             SERIAL PRIMARY KEY,
  receivable_id  INTEGER NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  num            INTEGER NOT NULL,
  valor          NUMERIC(10,2) NOT NULL DEFAULT 0,
  vencimento     DATE    NOT NULL,
  pago           BOOLEAN NOT NULL DEFAULT FALSE,
  pago_em        DATE
);

CREATE INDEX IF NOT EXISTS idx_recv_clinic ON receivables(clinic_id);
CREATE INDEX IF NOT EXISTS idx_recv_source ON receivables(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_recv_parc_recv ON receivable_parcelas(receivable_id);
CREATE INDEX IF NOT EXISTS idx_recv_parc_venc ON receivable_parcelas(vencimento) WHERE NOT pago;

-- Campos de pagamento nas origens
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE budgets         ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE budgets         ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
