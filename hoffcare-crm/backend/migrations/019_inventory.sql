-- Catálogo de itens do estoque por clínica
CREATE TABLE IF NOT EXISTS inventory_items (
  id           SERIAL PRIMARY KEY,
  clinic_id    INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  category     VARCHAR(50)  NOT NULL DEFAULT 'outro', -- medicamento | descartavel | acessorio | outro
  unit         VARCHAR(30)  NOT NULL DEFAULT 'un',    -- un, cx, ml, g, kg, etc
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock     DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Movimentações de estoque (entradas, saídas, ajustes)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id         SERIAL PRIMARY KEY,
  clinic_id  INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL, -- entrada | saida | ajuste
  quantity   DECIMAL(10,2) NOT NULL,
  unit_cost  DECIMAL(10,2),
  notes      TEXT,
  record_id  INTEGER REFERENCES records(id) ON DELETE SET NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_clinic ON inventory_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_clinic ON inventory_movements(clinic_id);
