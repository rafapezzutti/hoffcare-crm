const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// List appointments
router.get('/', auth, async (req, res) => {
  try {
    const { start, end, professional_id, room_id } = req.query;
    const clinic_id = req.user.clinic_id;
    const params = [];
    const conditions = ['1=1'];

    if (clinic_id) { conditions.push(`a.clinic_id = $${params.length+1}`); params.push(clinic_id); }
    if (start) { conditions.push(`a.appointment_date >= $${params.length+1}`); params.push(start); }
    if (end) { conditions.push(`a.appointment_date <= $${params.length+1}`); params.push(end); }
    if (professional_id) { conditions.push(`a.professional_id = $${params.length+1}`); params.push(professional_id); }
    if (room_id) { conditions.push(`a.room_id = $${params.length+1}`); params.push(room_id); }

    const query = `
      SELECT a.*, p.name as patient_name, p.cpf as patient_cpf,
             pr.name as professional_name, pr.type as professional_type,
             r.name as room_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN professionals pr ON a.professional_id = pr.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.appointment_date`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create appointment
router.post('/', auth, async (req, res) => {
  const { type, patient_id, professional_id, room_id, appointment_date, duration_minutes, notes } = req.body;
  if (!type || !patient_id || !professional_id || !appointment_date)
    return res.status(400).json({ error: 'Tipo, paciente, profissional e data são obrigatórios' });

  const clinic_id = req.user.clinic_id || req.body.clinic_id;
  try {
    const result = await pool.query(
      `INSERT INTO appointments (type, patient_id, professional_id, room_id, clinic_id, appointment_date, duration_minutes, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [type, patient_id, professional_id, room_id || null, clinic_id, appointment_date, duration_minutes || 30, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update appointment
router.put('/:id', auth, async (req, res) => {
  const { type, patient_id, professional_id, room_id, appointment_date, duration_minutes, notes, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE appointments SET type=$1, patient_id=$2, professional_id=$3, room_id=$4,
       appointment_date=$5, duration_minutes=$6, notes=$7, status=$8 WHERE id=$9 RETURNING *`,
      [type, patient_id, professional_id, room_id || null, appointment_date, duration_minutes || 30, notes, status || 'scheduled', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete appointment
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Consulta removida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
