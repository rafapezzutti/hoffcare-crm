const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const router  = express.Router();

// Auto-cria tabela se não existir
pool.query(`
  CREATE TABLE IF NOT EXISTS receipts (
    id                SERIAL PRIMARY KEY,
    clinic_id         INTEGER NOT NULL,
    patient_id        INTEGER,
    patient_name      TEXT,
    source_type       TEXT,
    source_id         INTEGER,
    amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_method    TEXT NOT NULL DEFAULT 'pix',
    payment_description TEXT,
    description       TEXT,
    professional_name TEXT,
    issued_at         TIMESTAMPTZ,
    sent_at           TIMESTAMPTZ,
    sent_to           TEXT,
    created_by        INTEGER,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(console.error);

// ── GET /api/receipts — lista com filtros ────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { clinic_id } = req.user;
  const { patient_id, source_type, source_id, issued, sent, limit = 100, offset = 0 } = req.query;

  let where = ['r.clinic_id = $1'];
  const params = [clinic_id];
  let idx = 2;

  if (patient_id) { where.push(`r.patient_id = $${idx++}`); params.push(patient_id); }
  if (source_type) { where.push(`r.source_type = $${idx++}`); params.push(source_type); }
  if (source_id)  { where.push(`r.source_id = $${idx++}`); params.push(source_id); }
  if (issued === 'true')  where.push('r.issued_at IS NOT NULL');
  if (issued === 'false') where.push('r.issued_at IS NULL');
  if (sent === 'true')    where.push('r.sent_at IS NOT NULL');
  if (sent === 'false')   where.push('r.sent_at IS NULL');

  try {
    const { rows } = await pool.query(
      `SELECT r.*, p.name as patient_name_db
       FROM receipts r
       LEFT JOIN patients p ON p.id = r.patient_id AND p.clinic_id = $1
       WHERE ${where.join(' AND ')}
       ORDER BY r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/receipts/alerts — alertas financeiros ───────────────────────────
router.get('/alerts', auth, async (req, res) => {
  const { clinic_id } = req.user;
  try {
    const [overdueRes, noPaymentRes, noReceiptRes] = await Promise.all([
      // Parcelas em atraso
      pool.query(`
        SELECT rp.id, rp.num, rp.vencimento, rp.valor,
               rec.patient_name, rec.descricao, rec.source_type, rec.source_id
        FROM receivable_parcelas rp
        JOIN receivables rec ON rec.id = rp.receivable_id
        WHERE rec.clinic_id = $1 AND NOT rp.pago AND rp.vencimento < CURRENT_DATE
        ORDER BY rp.vencimento
        LIMIT 50
      `, [clinic_id]).catch(() => ({ rows: [] })),

      // Atendimentos sem forma de pagamento (últimos 90 dias)
      pool.query(`
        SELECT mr.id, mr.consultation_date, pat.name as patient_name, mr.total_value
        FROM medical_records mr
        LEFT JOIN patients pat ON pat.id = mr.patient_id
        WHERE mr.clinic_id = $1
          AND (mr.payment_method IS NULL OR mr.payment_method = '')
          AND mr.total_value > 0
          AND mr.consultation_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY mr.consultation_date DESC
        LIMIT 20
      `, [clinic_id]).catch(() => ({ rows: [] })),

      // Atendimentos pagos sem recibo emitido (últimos 90 dias)
      pool.query(`
        SELECT mr.id, mr.consultation_date, pat.name as patient_name, mr.total_value, mr.payment_method
        FROM medical_records mr
        LEFT JOIN patients pat ON pat.id = mr.patient_id
        LEFT JOIN receipts rcp ON rcp.source_type = 'record' AND rcp.source_id = mr.id
        WHERE mr.clinic_id = $1
          AND mr.payment_method IS NOT NULL
          AND mr.total_value > 0
          AND rcp.id IS NULL
          AND mr.consultation_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY mr.consultation_date DESC
        LIMIT 20
      `, [clinic_id]).catch(() => ({ rows: [] })),
    ]);

    res.json({
      overdue_installments: overdueRes.rows,
      no_payment_method:    noPaymentRes.rows,
      no_receipt:           noReceiptRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/receipts — criar recibo ────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { clinic_id, id: userId } = req.user;
  const {
    patient_id, patient_name, source_type, source_id,
    amount, payment_method, payment_description,
    description, professional_name,
    issue_now = true,
  } = req.body;

  if (!amount || parseFloat(amount) <= 0)
    return res.status(400).json({ error: 'Valor do recibo é obrigatório.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO receipts
         (clinic_id, patient_id, patient_name, source_type, source_id,
          amount, payment_method, payment_description, description,
          professional_name, issued_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        clinic_id,
        patient_id || null,
        patient_name || null,
        source_type  || null,
        source_id    || null,
        parseFloat(amount),
        payment_method || 'pix',
        payment_description || null,
        description    || null,
        professional_name || null,
        issue_now ? new Date() : null,
        userId,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/receipts/:id — atualizar recibo ─────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  const { clinic_id } = req.user;
  const {
    patient_name, amount, payment_method, payment_description,
    description, professional_name,
    issued_at, sent_at, sent_to,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE receipts SET
         patient_name=$1, amount=$2, payment_method=$3, payment_description=$4,
         description=$5, professional_name=$6,
         issued_at=$7, sent_at=$8, sent_to=$9, updated_at=NOW()
       WHERE id=$10 AND clinic_id=$11 RETURNING *`,
      [
        patient_name || null,
        parseFloat(amount),
        payment_method || 'pix',
        payment_description || null,
        description || null,
        professional_name || null,
        issued_at || null,
        sent_at   || null,
        sent_to   || null,
        req.params.id,
        clinic_id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Recibo não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/receipts/:id ─────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const { clinic_id } = req.user;
  try {
    await pool.query('DELETE FROM receipts WHERE id=$1 AND clinic_id=$2', [req.params.id, clinic_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
