-- 027: Funcionários e Folha de Pagamento
CREATE TABLE IF NOT EXISTS employees (
  id               SERIAL PRIMARY KEY,
  clinic_id        INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id  INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  name             VARCHAR(200)  NOT NULL,
  cpf              VARCHAR(14),
  contract_type    VARCHAR(5)    NOT NULL DEFAULT 'CLT', -- CLT, PJ
  salary           DECIMAL(10,2) NOT NULL DEFAULT 0,
  hire_date        DATE          NOT NULL,
  termination_date DATE,
  status           VARCHAR(20)   NOT NULL DEFAULT 'ativo',
  -- Benefícios mensais (CLT)
  vr_value         DECIMAL(10,2) DEFAULT 0,   -- Vale Refeição
  vt_value         DECIMAL(10,2) DEFAULT 0,   -- Vale Transporte
  health_plan      DECIMAL(10,2) DEFAULT 0,   -- Plano de Saúde (custo empresa)
  other_benefits   DECIMAL(10,2) DEFAULT 0,
  -- PJ
  pj_cnpj          VARCHAR(18),
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll (
  id                    SERIAL PRIMARY KEY,
  clinic_id             INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  employee_id           INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  month                 INTEGER NOT NULL,
  year                  INTEGER NOT NULL,
  base_salary           DECIMAL(10,2) NOT NULL,
  -- Descontos
  inss                  DECIMAL(10,2) DEFAULT 0,
  irrf                  DECIMAL(10,2) DEFAULT 0,
  other_discounts       DECIMAL(10,2) DEFAULT 0,
  -- Adicionais
  overtime              DECIMAL(10,2) DEFAULT 0,
  other_additions       DECIMAL(10,2) DEFAULT 0,
  -- Benefícios pagos no mês
  vr_paid               DECIMAL(10,2) DEFAULT 0,
  vt_paid               DECIMAL(10,2) DEFAULT 0,
  health_plan_paid      DECIMAL(10,2) DEFAULT 0,
  -- Provisões (CLT — custo empresa)
  fgts_provision        DECIMAL(10,2) DEFAULT 0,  -- 8% salário
  thirteenth_provision  DECIMAL(10,2) DEFAULT 0,  -- 1/12 salário
  vacation_provision    DECIMAL(10,2) DEFAULT 0,  -- 1/12 × 4/3
  -- Totais
  net_salary            DECIMAL(10,2) NOT NULL,
  total_employer_cost   DECIMAL(10,2) DEFAULT 0,
  status                VARCHAR(20)   NOT NULL DEFAULT 'pendente',
  paid_date             DATE,
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_employees_clinic ON employees(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period   ON payroll(clinic_id, year, month);
