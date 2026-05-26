-- Migration 007: Aluguéis e Acertos Financeiros

-- Tabela de aluguéis de espaços do consultório
CREATE TABLE IF NOT EXISTS rentals (
  id            SERIAL PRIMARY KEY,
  clinic_id     INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  tenant_name   VARCHAR(200) NOT NULL,
  space_description VARCHAR(200),
  room_id       INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  value         NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date    DATE NOT NULL,
  end_date      DATE,
  recurrence    VARCHAR(20) DEFAULT 'mensal',  -- mensal, unico, trimestral, semestral, anual
  notes         TEXT,
  status        VARCHAR(20) DEFAULT 'active',  -- active, inactive
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Tabela de acertos financeiros entre clínica e profissionais
CREATE TABLE IF NOT EXISTS financial_settlements (
  id              SERIAL PRIMARY KEY,
  clinic_id       INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  value           NUMERIC(10,2) NOT NULL DEFAULT 0,
  date            DATE NOT NULL,
  description     TEXT,
  type            VARCHAR(20) DEFAULT 'a_pagar',
  -- a_pagar: clínica paga ao profissional (saída)
  -- a_receber: profissional paga à clínica (entrada)
  status          VARCHAR(20) DEFAULT 'pendente', -- pendente, pago
  created_at      TIMESTAMP DEFAULT NOW()
);
