const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { Resend } = require('resend');
const { upsertReceivable } = require('./receivables');
const router = express.Router();

// Sincroniza o orçamento com o contas a receber (não bloqueia o save)
async function syncBudgetReceivable(budget) {
  try {
    if (!budget.payment_method || !(Number(budget.total) > 0)) return;
    const { rows } = await pool.query('SELECT name FROM patients WHERE id=$1', [budget.patient_id]);
    await upsertReceivable({
      clinic_id: budget.clinic_id,
      source_type: 'orcamento',
      source_id: budget.id,
      patient_id: budget.patient_id,
      patient_name: rows[0]?.name || null,
      descricao: `Orçamento ${budget.number || budget.id}`,
      payment_method: budget.payment_method,
      installments: budget.installments || 1,
      total: budget.total,
      base_date: new Date().toISOString().slice(0, 10),
    });
  } catch (e) { console.error('[receivable] sync orçamento:', e.message); }
}

// GET /api/budgets — list budgets for clinic
router.get('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  const { status, patient_id } = req.query;
  const params = [clinic_id];
  const conditions = ['b.clinic_id = $1'];

  if (status) {
    conditions.push(`b.status = $${params.length + 1}`);
    params.push(status);
  }
  if (patient_id) {
    conditions.push(`b.patient_id = $${params.length + 1}`);
    params.push(patient_id);
  }

  try {
    const result = await pool.query(
      `SELECT b.*,
              pat.name AS patient_name,
              pro.name AS professional_name
       FROM budgets b
       LEFT JOIN patients pat ON pat.id = b.patient_id
       LEFT JOIN professionals pro ON pro.id = b.professional_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budgets/:id — get single budget with items
router.get('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const [budgetRes, itemsRes] = await Promise.all([
      pool.query(
        `SELECT b.*,
                pat.name AS patient_name,
                pro.name AS professional_name
         FROM budgets b
         LEFT JOIN patients pat ON pat.id = b.patient_id
         LEFT JOIN professionals pro ON pro.id = b.professional_id
         WHERE b.id = $1 AND b.clinic_id = $2`,
        [req.params.id, clinic_id]
      ),
      pool.query(
        `SELECT * FROM budget_items WHERE budget_id = $1 ORDER BY id`,
        [req.params.id]
      ),
    ]);

    if (!budgetRes.rows[0]) return res.status(404).json({ error: 'Orçamento não encontrado' });
    const budget = budgetRes.rows[0];
    budget.items = itemsRes.rows;
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets — create budget
router.post('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  const { patient_id, professional_id, valid_until, notes, items, payment_method, installments } = req.body;
  const budgetItems = Array.isArray(items) ? items : [];

  const total = budgetItems.reduce((sum, item) => {
    return sum + (parseFloat(item.unit_value) || 0) * (parseInt(item.quantity) || 1);
  }, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate sequential number
    const seqRes = await client.query(`SELECT nextval('budget_number_seq') AS num`);
    const number = 'ORC-' + String(seqRes.rows[0].num).padStart(6, '0');

    const budgetRes = await client.query(
      `INSERT INTO budgets
         (clinic_id, number, patient_id, professional_id, valid_until, notes, total, status, created_at, payment_method, installments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'rascunho', NOW(), $8, $9)
       RETURNING *`,
      [
        clinic_id,
        number,
        patient_id || null,
        professional_id || null,
        valid_until || null,
        notes || null,
        total,
        payment_method || null,
        payment_method === 'credito' ? (parseInt(installments) || 1) : 1,
      ]
    );

    const budget = budgetRes.rows[0];

    // Insert items
    const insertedItems = [];
    for (const item of budgetItems) {
      const qty = parseInt(item.quantity) || 1;
      const unitValue = parseFloat(item.unit_value) || 0;
      const itemRes = await client.query(
        `INSERT INTO budget_items
           (budget_id, procedure_id, procedure_name, quantity, unit_value, total_value)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          budget.id,
          item.procedure_id || null,
          item.procedure_name || null,
          qty,
          unitValue,
          qty * unitValue,
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    syncBudgetReceivable(budget); // contas a receber (assíncrono)
    budget.items = insertedItems;
    res.status(201).json(budget);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/budgets/:id — update budget (only if rascunho)
router.put('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { patient_id, professional_id, valid_until, notes, items, payment_method, installments } = req.body;
  const budgetItems = Array.isArray(items) ? items : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check budget exists and is rascunho
    const checkRes = await client.query(
      'SELECT * FROM budgets WHERE id = $1 AND clinic_id = $2',
      [req.params.id, clinic_id]
    );
    if (!checkRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }
    if (checkRes.rows[0].status !== 'rascunho') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Apenas orçamentos em rascunho podem ser editados' });
    }

    const total = budgetItems.reduce((sum, item) => {
      return sum + (parseFloat(item.unit_value) || 0) * (parseInt(item.quantity) || 1);
    }, 0);

    const budgetRes = await client.query(
      `UPDATE budgets
       SET patient_id=$1, professional_id=$2, valid_until=$3, notes=$4, total=$5, updated_at=NOW(),
           payment_method=$6, installments=$7
       WHERE id=$8 AND clinic_id=$9
       RETURNING *`,
      [
        patient_id || null,
        professional_id || null,
        valid_until || null,
        notes || null,
        total,
        payment_method || null,
        payment_method === 'credito' ? (parseInt(installments) || 1) : 1,
        req.params.id,
        clinic_id,
      ]
    );

    const budget = budgetRes.rows[0];

    // Delete old items and insert new ones
    await client.query('DELETE FROM budget_items WHERE budget_id = $1', [budget.id]);

    const insertedItems = [];
    for (const item of budgetItems) {
      const qty = parseInt(item.quantity) || 1;
      const unitValue = parseFloat(item.unit_value) || 0;
      const itemRes = await client.query(
        `INSERT INTO budget_items
           (budget_id, procedure_id, procedure_name, quantity, unit_value, total_value)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          budget.id,
          item.procedure_id || null,
          item.procedure_name || null,
          qty,
          unitValue,
          qty * unitValue,
        ]
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    syncBudgetReceivable(budget); // contas a receber (assíncrono)
    budget.items = insertedItems;
    res.json(budget);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/budgets/:id/status — update status
router.put('/:id/status', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { status } = req.body;
  const validStatuses = ['rascunho', 'enviado', 'aguardando', 'aceito', 'declinado', 'expirado'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` });
  }

  try {
    const setSentAt = status === 'enviado' ? ', sent_at = NOW()' : '';
    const result = await pool.query(
      `UPDATE budgets
       SET status = $1${setSentAt}, updated_at = NOW()
       WHERE id = $2 AND clinic_id = $3
       RETURNING *`,
      [status, req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Orçamento não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id — delete budget
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Orçamento não encontrado' });
    res.json({ message: 'Orçamento removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/budgets/:id/send-email — send budget by email
router.post('/:id/send-email', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { email, patient_name } = req.body;

  if (!email) return res.status(400).json({ error: 'Email do destinatário é obrigatório' });

  try {
    // Fetch budget with items, patient and professional names
    const [budgetRes, itemsRes] = await Promise.all([
      pool.query(
        `SELECT b.*,
                pat.name AS patient_name,
                pro.name AS professional_name
         FROM budgets b
         LEFT JOIN patients pat ON pat.id = b.patient_id
         LEFT JOIN professionals pro ON pro.id = b.professional_id
         WHERE b.id = $1 AND b.clinic_id = $2`,
        [req.params.id, clinic_id]
      ),
      pool.query(
        'SELECT * FROM budget_items WHERE budget_id = $1 ORDER BY id',
        [req.params.id]
      ),
    ]);

    if (!budgetRes.rows[0]) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const budget = budgetRes.rows[0];
    const items = itemsRes.rows;

    const displayPatientName = patient_name || budget.patient_name || 'Paciente';

    const formatCurrency = (value) =>
      parseFloat(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR');
    };

    const itemRows = items.map((item) => {
      const qty = parseInt(item.quantity) || 1;
      const unitValue = parseFloat(item.unit_value) || 0;
      const total = parseFloat(item.total_value) || qty * unitValue;
      return `
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #eee;">${item.procedure_name || '—'}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #eee; text-align:center;">${qty}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(unitValue)}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(total)}</td>
        </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento ${budget.number}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif; color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1A5276; padding:28px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">Orçamento</h1>
              <p style="margin:4px 0 0; color:#AED6F1; font-size:14px;">${budget.number}</p>
            </td>
          </tr>

          <!-- Budget Info -->
          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Paciente</span><br>
                    <strong style="font-size:15px;">${displayPatientName}</strong>
                  </td>
                  <td style="padding-bottom:10px; text-align:right;">
                    <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Data</span><br>
                    <strong style="font-size:15px;">${formatDate(budget.created_at)}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:10px;">
                    <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Profissional</span><br>
                    <strong style="font-size:15px;">${budget.professional_name || '—'}</strong>
                  </td>
                  <td style="padding-bottom:10px; text-align:right;">
                    <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Válido até</span><br>
                    <strong style="font-size:15px;">${formatDate(budget.valid_until)}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #eee; border-radius:6px; overflow:hidden;">
                <thead>
                  <tr style="background-color:#D6EAF8;">
                    <th style="padding:10px 12px; text-align:left; font-size:13px; color:#1A5276;">Procedimento</th>
                    <th style="padding:10px 12px; text-align:center; font-size:13px; color:#1A5276;">Qtd</th>
                    <th style="padding:10px 12px; text-align:right; font-size:13px; color:#1A5276;">Valor Unit.</th>
                    <th style="padding:10px 12px; text-align:right; font-size:13px; color:#1A5276;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows || '<tr><td colspan="4" style="padding:12px; text-align:center; color:#888;">Nenhum item</td></tr>'}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Grand Total -->
          <tr>
            <td style="padding:16px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td></td>
                  <td style="text-align:right; padding:12px 0; border-top:2px solid #1A5276;">
                    <span style="font-size:14px; color:#555; margin-right:16px;">Total Geral</span>
                    <strong style="font-size:20px; color:#1A5276;">${formatCurrency(budget.total)}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${budget.notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="background-color:#f9f9f9; border-left:3px solid #AED6F1; padding:12px 16px; border-radius:4px;">
                <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">Observações</span>
                <p style="margin:0; font-size:14px; color:#555; line-height:1.5;">${budget.notes}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:28px 32px; text-align:center; border-top:1px solid #eee; margin-top:24px;">
              <p style="margin:0; font-size:12px; color:#aaa;">
                Este orçamento foi gerado automaticamente pelo HoffCare.<br>
                Em caso de dúvidas, entre em contato com a clínica.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'HoffCare <noreply@psaude.ia.br>',
      to: email,
      subject: `Orçamento ${budget.number} — ${displayPatientName}`,
      html,
    });

    // Update status to enviado
    await pool.query(
      `UPDATE budgets SET status = 'enviado', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2`,
      [req.params.id, clinic_id]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
