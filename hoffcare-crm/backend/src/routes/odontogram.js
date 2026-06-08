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
      treatment_status VARCHAR(30) DEFAULT 'nao_iniciado',
      treatment_date   DATE,
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
  const { status, procedure_name, procedure_value, notes, payment_status, amount_paid, treatment_status, treatment_date } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO odontogram_teeth
         (clinic_id, patient_id, tooth_number, status, procedure_name, procedure_value, notes, payment_status, amount_paid, treatment_status, treatment_date, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (clinic_id, patient_id, tooth_number)
       DO UPDATE SET
         status           = EXCLUDED.status,
         procedure_name   = EXCLUDED.procedure_name,
         procedure_value  = EXCLUDED.procedure_value,
         notes            = EXCLUDED.notes,
         payment_status   = EXCLUDED.payment_status,
         amount_paid      = EXCLUDED.amount_paid,
         treatment_status = EXCLUDED.treatment_status,
         treatment_date   = EXCLUDED.treatment_date,
         updated_at       = NOW()
       RETURNING *`,
      [
        req.user.clinic_id, patient_id, tooth,
        status || null, procedure_name || null,
        procedure_value ? parseFloat(procedure_value) : null,
        notes || null,
        payment_status || 'pendente',
        amount_paid ? parseFloat(amount_paid) : 0,
        treatment_status || 'nao_iniciado',
        treatment_date || null,
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

// ── Faces ─────────────────────────────────────────────────────────────────────

async function ensureFacesTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontogram_tooth_faces (
      id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL, patient_id INTEGER NOT NULL,
      tooth_number VARCHAR(3) NOT NULL, face VARCHAR(2) NOT NULL, status VARCHAR(30),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(clinic_id, patient_id, tooth_number, face)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontogram_tooth_history (
      id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL, patient_id INTEGER NOT NULL,
      tooth_number VARCHAR(3) NOT NULL, procedure_name VARCHAR(200) NOT NULL,
      procedure_date DATE NOT NULL DEFAULT CURRENT_DATE,
      professional_name VARCHAR(200), notes TEXT, created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensureFacesTables().catch(console.error);

// GET /api/odontogram/:patient_id/faces — todas as faces do paciente
router.get('/:patient_id/faces', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM odontogram_tooth_faces WHERE patient_id=$1 AND clinic_id=$2',
      [req.params.patient_id, req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/odontogram/:patient_id/:tooth/faces — upsert faces de um dente
router.put('/:patient_id/:tooth/faces', auth, async (req, res) => {
  const { patient_id, tooth } = req.params;
  const { faces } = req.body; // { V: 'cariado', M: '', O: 'restaurado', ... }
  try {
    for (const [face, status] of Object.entries(faces)) {
      if (status) {
        await pool.query(
          `INSERT INTO odontogram_tooth_faces (clinic_id, patient_id, tooth_number, face, status, updated_at)
           VALUES ($1,$2,$3,$4,$5,NOW())
           ON CONFLICT (clinic_id, patient_id, tooth_number, face)
           DO UPDATE SET status=$5, updated_at=NOW()`,
          [req.user.clinic_id, patient_id, tooth, face, status]
        );
      } else {
        await pool.query(
          'DELETE FROM odontogram_tooth_faces WHERE clinic_id=$1 AND patient_id=$2 AND tooth_number=$3 AND face=$4',
          [req.user.clinic_id, patient_id, tooth, face]
        );
      }
    }
    const { rows } = await pool.query(
      'SELECT * FROM odontogram_tooth_faces WHERE patient_id=$1 AND clinic_id=$2 AND tooth_number=$3',
      [patient_id, req.user.clinic_id, tooth]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/odontogram/:patient_id/:tooth/history
router.get('/:patient_id/:tooth/history', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM odontogram_tooth_history
       WHERE patient_id=$1 AND clinic_id=$2 AND tooth_number=$3
       ORDER BY procedure_date DESC, created_at DESC`,
      [req.params.patient_id, req.user.clinic_id, req.params.tooth]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/odontogram/:patient_id/:tooth/history
router.post('/:patient_id/:tooth/history', auth, async (req, res) => {
  const { patient_id, tooth } = req.params;
  const { procedure_name, procedure_date, professional_name, notes } = req.body;
  if (!procedure_name?.trim()) return res.status(400).json({ error: 'Procedimento obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO odontogram_tooth_history
         (clinic_id, patient_id, tooth_number, procedure_name, procedure_date, professional_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.clinic_id, patient_id, tooth, procedure_name.trim(),
       procedure_date || new Date().toISOString().slice(0, 10),
       professional_name?.trim() || null, notes?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/odontogram/:patient_id/:tooth/history/:entry_id
router.delete('/:patient_id/:tooth/history/:entry_id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM odontogram_tooth_history WHERE id=$1 AND clinic_id=$2',
      [req.params.entry_id, req.user.clinic_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
