const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const clinic_id = req.user.role === 'admin' ? req.query.clinic_id : req.user.clinic_id;
    let query = 'SELECT * FROM professionals';
    const params = [];
    if (clinic_id) { query += ' WHERE clinic_id = $1'; params.push(clinic_id); }
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM professionals WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone } = req.body;
  if (!type || !name || !cpf || !crm_cro)
    return res.status(400).json({ error: 'Tipo, nome, CPF e CRM/CRO são obrigatórios' });

  const clinic_id = req.user.clinic_id || req.body.clinic_id;

  try {
    const result = await pool.query(
      `INSERT INTO professionals (type, name, cpf, crm_cro, birthdate, email, phone, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [type, name, cpf, crm_cro, birthdate || null, email, phone, clinic_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE professionals SET type=$1, name=$2, cpf=$3, crm_cro=$4, birthdate=$5, email=$6, phone=$7
       WHERE id=$8 RETURNING *`,
      [type, name, cpf, crm_cro, birthdate || null, email, phone, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM professionals WHERE id = $1', [req.params.id]);
    res.json({ message: 'Profissional removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
