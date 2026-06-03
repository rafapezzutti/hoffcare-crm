const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Garante tabela (fallback)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontogram_teeth (
      id               SERIAL PRIMARY KEY,
      clinic_id        INTEGER NOT NULL,
      patient_id       INTEGER NOT NULL,
      tooth_number     VARCHAR(3) NOT NULL,
      status           VARCHAR(50),
      procedure_name   VARCHAR(200),
      procedure_value  DECIMAL(10,2),
      notes            TEXT,
      payment_status   VARCHAR(20) DEFAULT 'pendente',
      amount_paid      DECIMAL(10,2) DEFAULT 0,
      updated_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(clinic_id, patient_id, tooth_number)
    )
  `);
}
ensureTable().catch(console.error);

// GET /api/odontogram?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM odontogram_teeth WHERE patient_id=$1 AND clinic_id=$2',
      [patient_id, req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/odontogram/:patient_id/:tooth — upsert de um dente
router.put('/:patient_id/:tooth', auth, async (req, res) => {
  const { patient_id, tooth } = req.params;
  const { status, procedure_name, procedure_value, notes, payment_status, amount_paid } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO odontogram_teeth
         (clinic_id, patient_id, tooth_number, status, procedure_name, procedure_value, notes, payment_status, amount_paid, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (clinic_id, patient_id, tooth_number)
       DO UPDATE SET
         status          = EXCLUDED.status,
         procedure_name  = EXCLUDED.procedure_name,
         procedure_value = EXCLUDED.procedure_value,
         notes           = EXCLUDED.notes,
         payment_status  = EXCLUDED.payment_status,
         amount_paid     = EXCLUDED.amount_paid,
         updated_at      = NOW()
       RETURNING *`,
      [
        req.user.clinic_id, patient_id, tooth,
        status || null, procedure_name || null,
        procedure_value ? parseFloat(procedure_value) : null,
        notes || null,
        payment_status || 'pendente',
        amount_paid ? parseFloat(amount_paid) : 0,
      ]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/odontogram/:patient_id/:tooth — limpa dados de um dente
router.delete('/:patient_id/:tooth', auth, async (req, res) => {
  const { patient_id, tooth } = req.params;
  try {
    await pool.query(
      'DELETE FROM odontogram_teeth WHERE clinic_id=$1 AND patient_id=$2 AND tooth_number=$3',
      [req.user.clinic_id, patient_id, tooth]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
