-- Adiciona controle de pagamento ao odontograma
ALTER TABLE odontogram_teeth
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS amount_paid    DECIMAL(10,2) DEFAULT 0;
