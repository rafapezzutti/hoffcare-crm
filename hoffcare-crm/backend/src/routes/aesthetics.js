const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/aesthetics?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  const clinic_id = req.user.clinic_id;
  try {
    const where = patient_id
      ? 'WHERE at.clinic_id=$1 AND at.patient_id=$2 ORDER BY at.treatment_date DESC'
      : 'WHERE at.clinic_id=$1 ORDER BY at.treatment_date DESC LIMIT 50';
    const params = patient_id ? [clinic_id, patient_id] : [clinic_id];
    const { rows } = await pool.query(`
      SELECT at.*,
             p.name  AS patient_name,
             pr.name AS professional_name
      FROM aesthetic_treatments at
      LEFT JOIN patients      p  ON p.id  = at.patient_id
      LEFT JOIN professionals pr ON pr.id = at.professional_id
      ${where}
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/aesthetics/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT at.*, p.name AS patient_name, pr.name AS professional_name
       FROM aesthetic_treatments at
       LEFT JOIN patients p ON p.id = at.patient_id
       LEFT JOIN professionals pr ON pr.id = at.professional_id
       WHERE at.id=$1 AND at.clinic_id=$2`,
      [req.params.id, req.user.clinic_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tratamento não encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/aesthetics
router.post('/', auth, async (req, res) => {
  const { patient_id, professional_id, treatment_date, points, product_brand,
          product_lot, product_validity, total_units, observations } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'Paciente obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO aesthetic_treatments
         (clinic_id, patient_id, professional_id, treatment_date, points,
          product_brand, product_lot, product_validity, total_units, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.clinic_id, patient_id, professional_id || null,
       treatment_date || new Date().toISOString().split('T')[0],
       JSON.stringify(points || []),
       product_brand || null, product_lot || null, product_validity || null,
       total_units || null, observations || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/aesthetics/:id
router.put('/:id', auth, async (req, res) => {
  const { patient_id, professional_id, treatment_date, points, product_brand,
          product_lot, product_validity, total_units, observations } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE aesthetic_treatments SET
         patient_id=$1, professional_id=$2, treatment_date=$3, points=$4,
         product_brand=$5, product_lot=$6, product_validity=$7,
         total_units=$8, observations=$9
       WHERE id=$10 AND clinic_id=$11 RETURNING *`,
      [patient_id, professional_id || null,
       treatment_date, JSON.stringify(points || []),
       product_brand || null, product_lot || null, product_validity || null,
       total_units || null, observations || null,
       req.params.id, req.user.clinic_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/aesthetics/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM aesthetic_treatments WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
