-- HoffCare CRM - Schema Inicial
-- Execute: node src/config/migrate.js

-- Consultórios
CREATE TABLE IF NOT EXISTS clinics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  responsible_name VARCHAR(255),
  responsible_cpf VARCHAR(14),
  cep VARCHAR(9),
  street VARCHAR(255),
  number VARCHAR(50),
  complement VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usuários do sistema
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'responsavel',
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Profissionais de saúde
CREATE TABLE IF NOT EXISTS professionals (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medico', 'dentista')),
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  crm_cro VARCHAR(50) NOT NULL,
  birthdate DATE,
  email VARCHAR(255),
  phone VARCHAR(20),
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Salas
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medico', 'dentista')),
  name VARCHAR(255) NOT NULL,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Procedimentos
CREATE TABLE IF NOT EXISTS procedures (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medico', 'odontologico')),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  cho INTEGER,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pacientes
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  birthdate DATE NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Declaração de saúde
CREATE TABLE IF NOT EXISTS health_declarations (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  has_diabetes BOOLEAN DEFAULT FALSE,
  is_smoker BOOLEAN DEFAULT FALSE,
  has_cardiac_history BOOLEAN DEFAULT FALSE,
  has_surgeries BOOLEAN DEFAULT FALSE,
  has_other_conditions BOOLEAN DEFAULT FALSE,
  other_conditions_comment TEXT,
  comment TEXT,
  declaration_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Anexos dos pacientes
CREATE TABLE IF NOT EXISTS patient_attachments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Consultas (calendário)
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medico', 'dentista')),
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Registros de procedimentos pós-consulta
CREATE TABLE IF NOT EXISTS medical_records (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('medico', 'dentista')),
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  professional_id INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  clinic_id INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  consultation_date DATE NOT NULL,
  total_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Itens de procedimento nos registros
CREATE TABLE IF NOT EXISTS medical_record_procedures (
  id SERIAL PRIMARY KEY,
  record_id INTEGER REFERENCES medical_records(id) ON DELETE CASCADE,
  procedure_id INTEGER REFERENCES procedures(id) ON DELETE SET NULL,
  procedure_name VARCHAR(500),
  procedure_code VARCHAR(30),
  value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_clinic ON medical_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_procedures_type ON procedures(type);
