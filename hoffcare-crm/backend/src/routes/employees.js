const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const router  = express.Router();

function p(v) { return parseFloat(v) || 0; }

// Cálculo INSS progressivo 2024
function calcINSS(salary) {
  const bands = [
    { limit: 1412.00, rate: 0.075 },
    { limit: 2666.68, rate: 0.09  },
    { limit: 4000.03, rate: 0.12  },
    { limit: 7786.02, rate: 0.14  },
  ];
  let inss = 0, prev = 0;
  for (const b of bands) {
    if (salary <= prev) break;
    inss += (Math.min(salary, b.limit) - prev) * b.rate;
    prev  = b.limit;
  }
  return Math.min(Math.round(inss * 100) / 100, 908.86);
}

// Cálculo IRRF 2024 (sobre salário – INSS)
function calcIRRF(base) {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.max(0, base * 0.075  - 169.44);
  if (base <= 3751.05) return Math.max(0, base * 0.15   - 381.44);
  if (base <= 4664.68) return Math.max(0, base * 0.225  - 662.77);
  return Math.max(0, base * 0.275 - 896.00);
}

function calcPayroll(emp) {
  const salary   = p(emp.salary);
  const inss     = emp.contract_type === 'CLT' ? calcINSS(salary) : 0;
  const irrf     = emp.contract_type === 'CLT' ? calcIRRF(salary - inss) : 0;
  const fgts     = emp.contract_type === 'CLT' ? Math.round(salary * 0.08 * 100) / 100 : 0;
  const th13     = emp.contract_type === 'CLT' ? Math.round((salary / 12) * 100) / 100 : 0;
  const vac      = emp.contract_type === 'CLT' ? Math.round((salary / 12) * (4 / 3) * 100) / 100 : 0;
  const benefits = p(emp.vr_value) + p(emp.vt_value) + p(emp.health_plan) + p(emp.other_benefits);
  const net      = Math.round((salary - inss - irrf) * 100) / 100;
  const total    = Math.round((salary + fgts + th13 + vac + benefits) * 100) / 100;
  return { base_salary: salary, inss, irrf, fgts_provision: fgts,
    thirteenth_provision: th13, vacation_provision: vac,
    vr_paid: p(emp.vr_value), vt_paid: p(emp.vt_value), health_plan_paid: p(emp.health_plan),
    net_salary: net, total_employer_cost: total };
}

// ── Employees ───────────────────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, pr.name AS professional_name, pr.type AS professional_type
      FROM employees e
      LEFT JOIN professionals pr ON pr.id = e.professional_id
      WHERE e.clinic_id = $1
      ORDER BY e.status DESC, e.name
    `, [req.user.clinic_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { name, cpf, contract_type, salary, hire_date, professional_id,
    vr_value, vt_value, health_plan, other_benefits, pj_cnpj, notes } = req.body;
  if (!name || !hire_date) return res.status(400).json({ error: 'Nome e data de admissão obrigatórios' });
  try {
    const result = await pool.query(`
      INSERT INTO employees
        (clinic_id, professional_id, name, cpf, contract_type, salary, hire_date,
         vr_value, vt_value, health_plan, other_benefits, pj_cnpj, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.clinic_id, professional_id || null, name, cpf || null,
       contract_type || 'CLT', p(salary), hire_date,
       p(vr_value), p(vt_value), p(health_plan), p(other_benefits),
       pj_cnpj || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { name, cpf, contract_type, salary, hire_date, termination_date, status,
    professional_id, vr_value, vt_value, health_plan, other_benefits, pj_cnpj, notes } = req.body;
  try {
    const result = await pool.query(`
      UPDATE employees SET
        name=$1, cpf=$2, contract_type=$3, salary=$4, hire_date=$5,
        termination_date=$6, status=$7, professional_id=$8,
        vr_value=$9, vt_value=$10, health_plan=$11, other_benefits=$12,
        pj_cnpj=$13, notes=$14
      WHERE id=$15 AND clinic_id=$16 RETURNING *`,
      [name, cpf || null, contract_type || 'CLT', p(salary), hire_date,
       termination_date || null, status || 'ativo', professional_id || null,
       p(vr_value), p(vt_value), p(health_plan), p(other_benefits),
       pj_cnpj || null, notes || null, req.params.id, req.user.clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE employees SET status='inativo', termination_date=CURRENT_DATE
       WHERE id=$1 AND clinic_id=$2`,
      [req.params.id, req.user.clinic_id]
    );
    res.json({ message: 'Funcionário desativado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payroll ──────────────────────────────────────────────────

// GET /api/employees/:id/payroll
router.get('/:id/payroll', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM payroll
      WHERE employee_id = $1 AND clinic_id = $2
      ORDER BY year DESC, month DESC
    `, [req.params.id, req.user.clinic_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/employees/:id/payroll — gera folha para um mês
router.post('/:id/payroll', auth, async (req, res) => {
  const { month, year, overtime, other_discounts, other_additions, notes } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'Mês e ano obrigatórios' });
  try {
    const empRes = await pool.query(
      'SELECT * FROM employees WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    if (!empRes.rows[0]) return res.status(404).json({ error: 'Funcionário não encontrado' });
    const emp = empRes.rows[0];
    const calc = calcPayroll(emp);

    // Ajustes manuais
    const ot  = p(overtime);
    const od  = p(other_discounts);
    const oa  = p(other_additions);
    const net = Math.round((calc.net_salary + ot + oa - od) * 100) / 100;
    const totalCost = Math.round((calc.total_employer_cost + ot + oa) * 100) / 100;

    const result = await pool.query(`
      INSERT INTO payroll
        (clinic_id, employee_id, month, year, base_salary, inss, irrf,
         other_discounts, overtime, other_additions,
         vr_paid, vt_paid, health_plan_paid,
         fgts_provision, thirteenth_provision, vacation_provision,
         net_salary, total_employer_cost, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (employee_id, month, year)
      DO UPDATE SET
        base_salary=$5, inss=$6, irrf=$7, other_discounts=$8,
        overtime=$9, other_additions=$10, vr_paid=$11, vt_paid=$12,
        health_plan_paid=$13, fgts_provision=$14, thirteenth_provision=$15,
        vacation_provision=$16, net_salary=$17, total_employer_cost=$18, notes=$19
      RETURNING *`,
      [req.user.clinic_id, req.params.id, month, year,
       calc.base_salary, calc.inss, calc.irrf, od, ot, oa,
       calc.vr_paid, calc.vt_paid, calc.health_plan_paid,
       calc.fgts_provision, calc.thirteenth_provision, calc.vacation_provision,
       net, totalCost, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/employees/:id/payroll/:pid — marcar como pago
router.put('/:id/payroll/:pid', auth, async (req, res) => {
  const { status, paid_date } = req.body;
  try {
    const result = await pool.query(`
      UPDATE payroll SET status=$1, paid_date=$2
      WHERE id=$3 AND clinic_id=$4 RETURNING *`,
      [status, paid_date || null, req.params.pid, req.user.clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Folha não encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/employees/:id/payroll/:pid
router.delete('/:id/payroll/:pid', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM payroll WHERE id=$1 AND clinic_id=$2',
      [req.params.pid, req.user.clinic_id]
    );
    res.json({ message: 'Folha removida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
