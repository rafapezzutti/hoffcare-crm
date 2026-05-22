-- Migração 002: Sistema de confirmação de consultas e recall
-- Execute no Neon SQL Editor

-- Novos campos na tabela appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS cancel_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Atualiza o CHECK constraint de status para incluir os novos status
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'pending_confirmation', 'confirmed', 'completed', 'cancelled'));

-- Atualiza registros existentes: 'scheduled' → 'pending_confirmation'
-- (opcional — só se quiser padronizar os existentes)
-- UPDATE appointments SET status = 'pending_confirmation' WHERE status = 'scheduled';

-- Configurações de e-mail por consultório
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS email_confirmations BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_recall BOOLEAN DEFAULT false;

-- Controle de recall por paciente
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS recall_sent_at TIMESTAMPTZ;

-- Índice para cron job de lembretes
CREATE INDEX IF NOT EXISTS idx_appointments_reminder
  ON appointments(appointment_date, reminder_sent, status);
