const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const router  = express.Router();

// GET /api/expenses — lista despesas da clínica
router.get('/', auth, async (req, res) => {
  try {
    const { status, category, month, year } = req.query;
    let conditions = ['clinic_id = $1'];
    let params     = [req.user.clinic_id];
    let idx        = 2;

    if (status && status !== 'all') {
      if (status === 'vencido') {
        conditions.push(`(status = 'pendente' AND due_date < CURRENT_DATE)`);
      } else if (status === 'pendente') {
        conditions.push(`(status = 'pendente' AND due_date >= CURRENT_DATE)`);
      } else {
        conditions.push(`status = $${idx++}`);
        params.push(status);
      }
    }
    if (category) {
      conditions.push(`category = $${idx++}`);
      params.push(category);
    }
    if (month && year) {
      conditions.push(`EXTRACT(MONTH FROM due_date) = $${idx++}`);
      params.push(Number(month));
      conditions.push(`EXTRACT(YEAR FROM due_date) = $${idx++}`);
      params.push(Number(year));
    }

    const result = await pool.query(
      `SELECT * FROM expenses WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/expenses
router.post('/', auth, async (req, res) => {
  try {
    const { category, description, amount, due_date, recurrence, notes } = req.body;
    if (!category || !amount || !due_date)
      return res.status(400).json({ error: 'Campos obrigatorios: categoria, valor, vencimento' });
    const result = await pool.query(
      `INSERT INTO expenses (clinic_id, category, description, amount, due_date, recurrence, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.clinic_id, category, description || null, parseFloat(amount), due_date, recurrence || 'none', notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/expenses/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { category, description, amount, due_date, status, paid_date, recurrence, notes } = req.body;
    const result = await pool.query(
      `UPDATE expenses
       SET category=$1, description=$2, amount=$3, due_date=$4,
           status=$5, paid_date=$6, recurrence=$7, notes=$8
       WHERE id=$9 AND clinic_id=$10 RETURNING *`,
      [category, description || null, parseFloat(amount), due_date,
       status || 'pendente', paid_date || null, recurrence || 'none', notes || null,
       req.params.id, req.user.clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Despesa nao encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id=$1 AND clinic_id=$2', [req.params.id, req.user.clinic_id]);
    res.json({ message: 'Despesa removida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
