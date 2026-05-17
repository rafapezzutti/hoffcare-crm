const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const clinic_id = req.user.role === 'admin' ? req.query.clinic_id : req.user.clinic_id;
    let query = 'SELECT * FROM rooms';
    const params = [];
    if (clinic_id) { query += ' WHERE clinic_id = $1'; params.push(clinic_id); }
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { type, name } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'Tipo e nome são obrigatórios' });
  const clinic_id = req.user.clinic_id || req.body.clinic_id;
  try {
    const result = await pool.query(
      'INSERT INTO rooms (type, name, clinic_id) VALUES ($1,$2,$3) RETURNING *',
      [type, name, clinic_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { type, name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE rooms SET type=$1, name=$2 WHERE id=$3 RETURNING *',
      [type, name, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Sala não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    res.json({ message: 'Sala removida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
