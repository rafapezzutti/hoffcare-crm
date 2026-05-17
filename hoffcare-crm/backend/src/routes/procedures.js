const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM procedures WHERE active = true';
    const params = [];
    if (type) { query += ' AND type = $1'; params.push(type); }
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', auth, async (req, res) => {
  const { q, type } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM procedures WHERE active = true
       AND ($1::text IS NULL OR type = $1)
       AND (name ILIKE $2 OR code ILIKE $2)
       ORDER BY name LIMIT 50`,
      [type || null, `%${q || ''}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { type, code, name, cho } = req.body;
  if (!type || !code || !name)
    return res.status(400).json({ error: 'Tipo, código e nome são obrigatórios' });

  const clinic_id = req.user.clinic_id || req.body.clinic_id || null;
  try {
    const result = await pool.query(
      'INSERT INTO procedures (type, code, name, cho, clinic_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [type, code, name, cho || null, clinic_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { type, code, name, cho, active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE procedures SET type=$1, code=$2, name=$3, cho=$4, active=$5 WHERE id=$6 RETURNING *',
      [type, code, name, cho || null, active !== false, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Procedimento não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('UPDATE procedures SET active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Procedimento desativado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
