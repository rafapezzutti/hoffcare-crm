-- Usuário Trial / Teste
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_blocked_at TIMESTAMP;

-- Índice para o cron de expiração
CREATE INDEX IF NOT EXISTS idx_users_trial ON users(is_trial, trial_expires_at) WHERE is_trial = TRUE;
