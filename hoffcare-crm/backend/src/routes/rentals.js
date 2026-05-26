const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Listar aluguéis da clínica
router.get('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT r.*, rm.name as room_name
       FROM rentals r
       LEFT JOIN rooms rm ON r.room_id = rm.id
       WHERE r.clinic_id = $1
       ORDER BY r.start_date DESC`,
      [clinic_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar aluguel
router.post('/', auth, async (req, res) => {
  const { tenant_name, space_description, room_id, value, start_date, end_date, recurrence, notes, status } = req.body;
  if (!tenant_name || !value || !start_date)
    return res.status(400).json({ error: 'Nome do locatário, valor e data de início são obrigatórios' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  try {
    const result = await pool.query(
      `INSERT INTO rentals (clinic_id, tenant_name, space_description, room_id, value, start_date, end_date, recurrence, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [clinic_id, tenant_name, space_description || null, room_id || null,
       value, start_date, end_date || null, recurrence || 'mensal', notes || null, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar aluguel
router.put('/:id', auth, async (req, res) => {
  const { tenant_name, space_description, room_id, value, start_date, end_date, recurrence, notes, status } = req.body;
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      `UPDATE rentals SET tenant_name=$1, space_description=$2, room_id=$3, value=$4,
       start_date=$5, end_date=$6, recurrence=$7, notes=$8, status=$9
       WHERE id=$10 AND clinic_id=$11 RETURNING *`,
      [tenant_name, space_description || null, room_id || null, value,
       start_date, end_date || null, recurrence || 'mensal', notes || null, status || 'active',
       req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Aluguel não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover aluguel
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM rentals WHERE id=$1 AND clinic_id=$2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Aluguel não encontrado' });
    res.json({ message: 'Aluguel removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
