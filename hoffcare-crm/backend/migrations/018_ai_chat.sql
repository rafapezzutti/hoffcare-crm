-- Permissão de acesso ao Talk to Me por usuário
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_use_ai_chat BOOLEAN NOT NULL DEFAULT false;

-- Controle de uso diário da IA por usuário (reset à meia-noite horário SP)
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date  DATE    NOT NULL DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE,
  call_count  INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
