-- 030: Recibos — controle de emissão e envio
CREATE TABLE IF NOT EXISTS receipts (
  id                SERIAL PRIMARY KEY,
  clinic_id         INTEGER NOT NULL,
  patient_id        INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  patient_name      TEXT,
  -- vínculo opcional com origem
  source_type       TEXT,                         -- 'record' | 'budget' | 'avulso'
  source_id         INTEGER,
  -- dados financeiros
  amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'pix', -- pix|debito|credito|dinheiro|boleto
  payment_description TEXT,                      -- campo livre para descrever o pagamento
  description       TEXT,                        -- serviço / observação
  professional_name TEXT,
  -- controle de emissão e envio
  issued_at         TIMESTAMPTZ,                 -- quando o recibo foi emitido
  sent_at           TIMESTAMPTZ,                 -- quando foi enviado ao paciente
  sent_to           TEXT,                        -- e-mail ou "WhatsApp" ou outro
  -- metadados
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_clinic    ON receipts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_receipts_patient   ON receipts(patient_id);
CREATE INDEX IF NOT EXISTS idx_receipts_source    ON receipts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued    ON receipts(issued_at) WHERE issued_at IS NOT NULL;
