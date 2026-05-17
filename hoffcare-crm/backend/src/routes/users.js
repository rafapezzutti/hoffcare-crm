const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// List users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id, c.name as clinic_name, u.created_at
       FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  const { name, email, password, role, clinic_id } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, senha, perfil' });

  if (!['admin', 'responsavel'].includes(role))
    return res.status(400).json({ error: 'Perfil inválido. Use: admin ou responsavel' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, clinic_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, clinic_id`,
      [name, email, hashed, role, clinic_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// Update user (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, email, password, role, clinic_id } = req.body;
  try {
    let query, params;
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query = `UPDATE users SET name=$1, email=$2, password=$3, role=$4, clinic_id=$5 WHERE id=$6 RETURNING id, name, email, role, clinic_id`;
      params = [name, email, hashed, role, clinic_id || null, req.params.id];
    } else {
      query = `UPDATE users SET name=$1, email=$2, role=$3, clinic_id=$4 WHERE id=$5 RETURNING id, name, email, role, clinic_id`;
      params = [name, email, role, clinic_id || null, req.params.id];
    }
    const result = await pool.query(query, params);
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Usuário removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
