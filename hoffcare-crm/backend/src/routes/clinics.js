const express = require('express');
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Consultório não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { name, responsible_name, responsible_cpf, cep, street, number, complement, phone, email,
          email_confirmations, email_reminders, email_recall } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome do consultório é obrigatório' });

  try {
    const result = await pool.query(
      `INSERT INTO clinics (name, responsible_name, responsible_cpf, cep, street, number, complement,
        phone, email, email_confirmations, email_reminders, email_recall)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, responsible_name, responsible_cpf, cep, street, number, complement, phone, email,
       !!email_confirmations, !!email_reminders, !!email_recall]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, responsible_name, responsible_cpf, cep, street, number, complement, phone, email,
          email_confirmations, email_reminders, email_recall } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clinics SET name=$1, responsible_name=$2, responsible_cpf=$3, cep=$4,
       street=$5, number=$6, complement=$7, phone=$8, email=$9,
       email_confirmations=$10, email_reminders=$11, email_recall=$12
       WHERE id=$13 RETURNING *`,
      [name, responsible_name, responsible_cpf, cep, street, number, complement, phone, email,
       !!email_confirmations, !!email_reminders, !!email_recall, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consultório não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM clinics WHERE id = $1', [req.params.id]);
    res.json({ message: 'Consultório removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
