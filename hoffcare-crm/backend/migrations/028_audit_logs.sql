-- 028: Log de auditoria (LGPD) — registra todas as ações de escrita no sistema
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  clinic_id   INTEGER,
  user_id     INTEGER,
  user_name   TEXT,
  user_role   TEXT,
  action      TEXT NOT NULL,        -- 'create', 'update', 'delete', 'login'
  entity      TEXT,                 -- 'patients', 'appointments', 'records', etc.
  entity_id   TEXT,
  method      TEXT,
  path        TEXT,
  status_code INTEGER,
  details     JSONB,                -- payload sanitizado (sem senhas/tokens/base64)
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_clinic  ON audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
