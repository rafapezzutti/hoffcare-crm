const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const router  = express.Router();

function parseNum(v) { return parseFloat(v) || 0; }

function defaultPeriod() {
  const n = new Date();
  const start = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  const end   = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

// GET /api/cash-flow?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json({ totalEntradas: 0, totalSaidas: 0, saldo: 0, transactions: [], bySource: {} });

  const def   = defaultPeriod();
  const start = req.query.start || def.start;
  const end   = req.query.end   || def.end;

  try {
    const [recordsRes, rentalsRes, settlementsRes, expensesRes, payrollRes] = await Promise.all([

      // Atendimentos — soma de procedimentos por dia de consulta
      pool.query(`
        SELECT mr.consultation_date::date AS date,
               COALESCE(SUM(mrp.value), 0) AS amount,
               COUNT(DISTINCT mr.id)        AS qty
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1
          AND mr.consultation_date::date BETWEEN $2 AND $3
        GROUP BY mr.consultation_date::date
        HAVING COALESCE(SUM(mrp.value), 0) > 0
        ORDER BY date
      `, [clinic_id, start, end]),

      // Aluguéis — cobranças ativas no período
      pool.query(`
        SELECT start_date AS date, value AS amount, tenant_name AS description
        FROM rentals
        WHERE clinic_id = $1 AND status = 'active'
          AND start_date BETWEEN $2 AND $3
        ORDER BY start_date
      `, [clinic_id, start, end]),

      // Acertos financeiros pagos
      pool.query(`
        SELECT date, value AS amount, type, description
        FROM financial_settlements
        WHERE clinic_id = $1 AND status = 'pago'
          AND date BETWEEN $2 AND $3
        ORDER BY date
      `, [clinic_id, start, end]),

      // Despesas pagas no período
      pool.query(`
        SELECT paid_date AS date, amount, category, description
        FROM expenses
        WHERE clinic_id = $1 AND status = 'pago'
          AND paid_date BETWEEN $2 AND $3
        ORDER BY paid_date
      `, [clinic_id, start, end]),

      // Folha de pagamento paga no período
      pool.query(`
        SELECT pr.paid_date AS date, pr.total_employer_cost AS amount,
               e.name AS description, e.contract_type
        FROM payroll pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.clinic_id = $1 AND pr.status = 'pago'
          AND pr.paid_date BETWEEN $2 AND $3
        ORDER BY pr.paid_date
      `, [clinic_id, start, end]),
    ]);

    const transactions = [];

    for (const r of recordsRes.rows) {
      transactions.push({
        date:       r.date,
        type:       'entrada',
        source:     'Atendimentos',
        source_key: 'records',
        amount:     parseNum(r.amount),
        description:`${r.qty} atendimento(s)`,
      });
    }

    for (const r of rentalsRes.rows) {
      transactions.push({
        date:       r.date,
        type:       'entrada',
        source:     'Aluguéis',
        source_key: 'rentals',
        amount:     parseNum(r.amount),
        description: r.description,
      });
    }

    for (const r of settlementsRes.rows) {
      const isEntrada = r.type === 'a_receber';
      transactions.push({
        date:       r.date,
        type:       isEntrada ? 'entrada' : 'saida',
        source:     'Acertos',
        source_key: 'settlements',
        amount:     parseNum(r.amount),
        description: r.description || (isEntrada ? 'A receber' : 'A pagar'),
      });
    }

    for (const r of expensesRes.rows) {
      transactions.push({
        date:       r.date,
        type:       'saida',
        source:     'Despesas',
        source_key: 'expenses',
        amount:     parseNum(r.amount),
        description: r.description || r.category,
      });
    }

    for (const r of payrollRes.rows) {
      transactions.push({
        date:       r.date,
        type:       'saida',
        source:     'Funcionários',
        source_key: 'payroll',
        amount:     parseNum(r.amount),
        description: `Folha — ${r.description} (${r.contract_type})`,
      });
    }

    // Mais recente primeiro
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalEntradas = transactions.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0);
    const totalSaidas   = transactions.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0);
    const saldo         = totalEntradas - totalSaidas;

    // Agrupamento por origem
    const bySource = {};
    for (const t of transactions) {
      if (!bySource[t.source]) bySource[t.source] = { entradas: 0, saidas: 0 };
      if (t.type === 'entrada') bySource[t.source].entradas += t.amount;
      else                      bySource[t.source].saidas   += t.amount;
    }

    res.json({ totalEntradas, totalSaidas, saldo, transactions, bySource, period: { start, end } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cash-flow/monthly?year=YYYY
router.get('/monthly', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);

  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    const [recordsByMonth, expensesByMonth, rentalsByMonth] = await Promise.all([

      pool.query(`
        SELECT EXTRACT(MONTH FROM mr.consultation_date)::int AS month,
               COALESCE(SUM(mrp.value), 0) AS total
        FROM medical_records mr
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1 AND EXTRACT(YEAR FROM mr.consultation_date) = $2
        GROUP BY month
      `, [clinic_id, year]),

      pool.query(`
        SELECT EXTRACT(MONTH FROM paid_date)::int AS month, COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE clinic_id = $1 AND status = 'pago' AND EXTRACT(YEAR FROM paid_date) = $2
        GROUP BY month
      `, [clinic_id, year]),

      pool.query(`
        SELECT EXTRACT(MONTH FROM start_date)::int AS month, COALESCE(SUM(value), 0) AS total
        FROM rentals
        WHERE clinic_id = $1 AND status = 'active' AND EXTRACT(YEAR FROM start_date) = $2
        GROUP BY month
      `, [clinic_id, year]),
    ]);

    const rMap = Object.fromEntries(recordsByMonth.rows.map(r => [r.month, parseNum(r.total)]));
    const eMap = Object.fromEntries(expensesByMonth.rows.map(r => [r.month, parseNum(r.total)]));
    const lMap = Object.fromEntries(rentalsByMonth.rows.map(r => [r.month, parseNum(r.total)]));

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const entradas = (rMap[m] || 0) + (lMap[m] || 0);
      const saidas   =  eMap[m] || 0;
      months.push({ month: m, entradas, saidas, saldo: entradas - saidas });
    }

    res.json(months);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
