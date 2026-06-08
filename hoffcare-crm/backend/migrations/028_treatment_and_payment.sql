-- Migration 028: treatment_status + treatment_date no odontograma; payment_splits em records e budgets

-- Odontograma: status de tratamento e data de realização
ALTER TABLE odontogram_teeth ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(30) DEFAULT 'nao_iniciado';
ALTER TABLE odontogram_teeth ADD COLUMN IF NOT EXISTS treatment_date DATE;

-- Prontuários: splits de pagamento (multipagamento)
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS payment_splits JSONB;

-- Orçamentos: splits de pagamento
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS payment_splits JSONB;
