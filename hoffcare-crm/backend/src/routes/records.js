const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// List records (history)
router.get('/', auth, async (req, res) => {
  try {
    const { patient_id, cpf, patient_name } = req.query;
    const clinic_id = req.user.clinic_id;
    const params = [];
    const conditions = [];

    // clinic_id é obrigatório — sem clínica, retorna vazio
    if (clinic_id) { conditions.push(`mr.clinic_id = $${params.length+1}`); params.push(clinic_id); }
    else { return res.json([]); }

    if (patient_id) { conditions.push(`mr.patient_id = $${params.length+1}`); params.push(patient_id); }
    if (cpf) { conditions.push(`p.cpf ILIKE $${params.length+1}`); params.push(`%${cpf}%`); }
    if (patient_name) { conditions.push(`p.name ILIKE $${params.length+1}`); params.push(`%${patient_name}%`); }

    const query = `
      SELECT mr.*, p.name as patient_name, p.cpf as patient_cpf,
             pr.name as professional_name, pr.crm_cro, pr.type as professional_type
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN professionals pr ON mr.professional_id = pr.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mr.consultation_date DESC, mr.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resumo financeiro mensal
router.get('/monthly', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json({ total_revenue: '0', total_records: '0', total_procedures: '0', by_day: [], by_type: [] });

  const y = parseInt(req.query.year) || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    const [summary, byDay, byType, rentals, settlements] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT mr.id) as total_records,
          COALESCE(SUM(mrp.value), 0) as total_revenue,
          COUNT(mrp.id) as total_procedures
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1
          AND EXTRACT(YEAR FROM mr.consultation_date) = $2
          AND EXTRACT(MONTH FROM mr.consultation_date) = $3
      `, [clinic_id, y, m]),

      pool.query(`
        SELECT
          EXTRACT(DAY FROM mr.consultation_date)::int as day,
          COALESCE(SUM(mrp.value), 0) as revenue,
          COUNT(DISTINCT mr.id) as records
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1
          AND EXTRACT(YEAR FROM mr.consultation_date) = $2
          AND EXTRACT(MONTH FROM mr.consultation_date) = $3
        GROUP BY EXTRACT(DAY FROM mr.consultation_date)
        ORDER BY day
      `, [clinic_id, y, m]),

      pool.query(`
        SELECT
          mr.type,
          COUNT(DISTINCT mr.id) as records,
          COALESCE(SUM(mrp.value), 0) as revenue
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1
          AND EXTRACT(YEAR FROM mr.consultation_date) = $2
          AND EXTRACT(MONTH FROM mr.consultation_date) = $3
        GROUP BY mr.type
        ORDER BY revenue DESC
      `, [clinic_id, y, m]),

      // Aluguéis ativos no mês
      pool.query(`
        SELECT COALESCE(SUM(value), 0) as total_rentals, COUNT(*) as count_rentals
        FROM rentals
        WHERE clinic_id = $1 AND status = 'active'
          AND start_date <= $2::date
          AND (end_date IS NULL OR end_date >= $3::date)
      `, [clinic_id,
          `${y}-${String(m).padStart(2,'0')}-28`,
          `${y}-${String(m).padStart(2,'0')}-01`]),

      // Acertos do mês
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'a_receber' THEN value ELSE 0 END), 0) as total_in,
          COALESCE(SUM(CASE WHEN type = 'a_pagar'   THEN value ELSE 0 END), 0) as total_out,
          COUNT(*) as count_settlements
        FROM financial_settlements
        WHERE clinic_id = $1
          AND EXTRACT(YEAR FROM date) = $2
          AND EXTRACT(MONTH FROM date) = $3
      `, [clinic_id, y, m]),
    ]);

    const totalRevenue = parseFloat(summary.rows[0].total_revenue);
    const totalRentals = parseFloat(rentals.rows[0].total_rentals);
    const totalIn = parseFloat(settlements.rows[0].total_in);
    const totalOut = parseFloat(settlements.rows[0].total_out);

    res.json({
      ...summary.rows[0],
      by_day: byDay.rows,
      by_type: byType.rows,
      total_rentals: totalRentals,
      count_rentals: parseInt(rentals.rows[0].count_rentals),
      total_settlements_in: totalIn,
      total_settlements_out: totalOut,
      count_settlements: parseInt(settlements.rows[0].count_settlements),
      grand_total: totalRevenue + totalRentals + totalIn - totalOut,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single record with procedures
router.get('/:id', auth, async (req, res) => {
  try {
    const clinic_id = req.user.clinic_id;
    const record = await pool.query(
      `SELECT mr.*, p.name as patient_name, p.cpf as patient_cpf, p.birthdate as patient_birthdate,
              pr.name as professional_name, pr.crm_cro, pr.type as professional_type,
              c.name as clinic_name, c.phone as clinic_phone, c.email as clinic_email,
              c.street, c.number, c.complement, c.cep
       FROM medical_records mr
       LEFT JOIN patients p ON mr.patient_id = p.id
       LEFT JOIN professionals pr ON mr.professional_id = pr.id
       LEFT JOIN clinics c ON mr.clinic_id = c.id
       WHERE mr.id = $1 AND mr.clinic_id = $2`, [req.params.id, clinic_id]
    );
    if (!record.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });

    const procedures = await pool.query(
      'SELECT * FROM medical_record_procedures WHERE record_id = $1 ORDER BY id',
      [req.params.id]
    );

    res.json({ ...record.rows[0], procedures: procedures.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create record
router.post('/', auth, async (req, res) => {
  const { type, patient_id, professional_id, consultation_date, procedures } = req.body;
  if (!type || !patient_id || !professional_id || !consultation_date)
    return res.status(400).json({ error: 'Tipo, paciente, profissional e data são obrigatórios' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const total = (procedures || []).reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

    const record = await client.query(
      `INSERT INTO medical_records (type, patient_id, professional_id, clinic_id, consultation_date, total_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [type, patient_id, professional_id, clinic_id, consultation_date, total]
    );
    const recordId = record.rows[0].id;

    for (const proc of (procedures || [])) {
      await client.query(
        `INSERT INTO medical_record_procedures (record_id, procedure_id, procedure_name, procedure_code, value)
         VALUES ($1,$2,$3,$4,$5)`,
        [recordId, proc.procedure_id || null, proc.procedure_name, proc.procedure_code, proc.value || 0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...record.rows[0], procedures: procedures || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update record
router.put('/:id', auth, async (req, res) => {
  const { type, patient_id, professional_id, consultation_date, procedures } = req.body;
  const clinic_id = req.user.clinic_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = (procedures || []).reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

    const record = await client.query(
      `UPDATE medical_records SET type=$1, patient_id=$2, professional_id=$3, consultation_date=$4, total_value=$5
       WHERE id=$6 AND clinic_id=$7 RETURNING *`,
      [type, patient_id, professional_id, consultation_date, total, req.params.id, clinic_id]
    );
    if (!record.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Registro não encontrado' }); }

    await client.query('DELETE FROM medical_record_procedures WHERE record_id = $1', [req.params.id]);
    for (const proc of (procedures || [])) {
      await client.query(
        `INSERT INTO medical_record_procedures (record_id, procedure_id, procedure_name, procedure_code, value)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, proc.procedure_id || null, proc.procedure_name, proc.procedure_code, proc.value || 0]
      );
    }

    await client.query('COMMIT');
    res.json({ ...record.rows[0], procedures: procedures || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete record
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verifica se o registro pertence à clínica antes de apagar
    const check = await client.query(
      'SELECT id FROM medical_records WHERE id = $1 AND clinic_id = $2',
      [req.params.id, clinic_id]
    );
    if (!check.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Registro não encontrado' }); }
    await client.query('DELETE FROM medical_record_procedures WHERE record_id = $1', [req.params.id]);
    await client.query('DELETE FROM medical_records WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Registro removido' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
