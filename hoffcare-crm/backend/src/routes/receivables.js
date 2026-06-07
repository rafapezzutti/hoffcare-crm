const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Gera as parcelas: 1ª paga no ato; demais a cada 30 dias.
// pix/debito = 1 parcela paga no ato.
async function gerarParcelas(client, receivableId, total, installments, baseDate) {
  await client.query('DELETE FROM receivable_parcelas WHERE receivable_id=$1', [receivableId]);
  const n = Math.max(1, Math.min(12, installments || 1));
  const valorParcela = Math.floor((total / n) * 100) / 100;
  const resto = Math.round((total - valorParcela * n) * 100) / 100; // ajuste de centavos na 1ª
  for (let i = 1; i <= n; i++) {
    const venc = new Date(baseDate);
    venc.setDate(venc.getDate() + (i - 1) * 30);
    const valor = i === 1 ? Math.round((valorParcela + resto) * 100) / 100 : valorParcela;
    const pagaNoAto = i === 1; // 1ª parcela (ou à vista) é paga no ato
    await client.query(
      `INSERT INTO receivable_parcelas (receivable_id, num, valor, vencimento, pago, pago_em)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [receivableId, i, valor, venc.toISOString().slice(0, 10),
       pagaNoAto, pagaNoAto ? baseDate : null]
    );
  }
}

// Cria/atualiza o título a partir de uma origem (chamado por records/budgets ou direto)
async function upsertReceivable({ clinic_id, source_type, source_id, patient_id, patient_name, descricao, payment_method, installments, total, base_date }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inst = payment_method === 'credito' ? Math.max(1, Math.min(12, installments || 1)) : 1;
    const { rows } = await client.query(
      `INSERT INTO receivables (clinic_id, source_type, source_id, patient_id, patient_name, descricao, payment_method, installments, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (source_type, source_id)
       DO UPDATE SET patient_id=$4, patient_name=$5, descricao=$6, payment_method=$7, installments=$8, total=$9
       RETURNING id`,
      [clinic_id || null, source_type, source_id, patient_id || null, patient_name || null,
       descricao || null, payment_method || 'pix', inst, total || 0]
    );
    await gerarParcelas(client, rows[0].id, Number(total) || 0, inst, base_date || new Date().toISOString().slice(0, 10));
    await client.query('COMMIT');
    return rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Status calculado de um título
function calcStatus(r) {
  const hoje = new Date().toISOString().slice(0, 10);
  const abertas = r.parcelas.filter(p => !p.pago);
  if (!abertas.length) return 'pago';
  const vencidas = abertas.filter(p => String(p.vencimento).slice(0, 10) < hoje);
  if (vencidas.length) return r.installments > 1 ? 'parcela_atrasada' : 'atrasado';
  return 'em_dia';
}

// POST /api/receivables — cria/atualiza título manualmente
router.post('/', auth, async (req, res) => {
  try {
    const id = await upsertReceivable({ ...req.body, clinic_id: req.user.clinic_id });
    res.status(201).json({ id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar título' }); }
});

// GET /api/receivables?status=&search=&source_type=
router.get('/', auth, async (req, res) => {
  const { status, search, source_type } = req.query;
  const params = [];
  const where = [];
  if (req.user.clinic_id) { params.push(req.user.clinic_id); where.push(`r.clinic_id = $${params.length}`); }
  if (source_type) { params.push(source_type); where.push(`r.source_type = $${params.length}`); }
  if (search) { params.push(`%${search}%`); where.push(`(r.patient_name ILIKE $${params.length} OR r.descricao ILIKE $${params.length})`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
              COALESCE(json_agg(json_build_object(
                'id', p.id, 'num', p.num, 'valor', p.valor,
                'vencimento', p.vencimento, 'pago', p.pago, 'pago_em', p.pago_em
              ) ORDER BY p.num) FILTER (WHERE p.id IS NOT NULL), '[]') AS parcelas
       FROM receivables r
       LEFT JOIN receivable_parcelas p ON p.receivable_id = r.id
       ${whereSql}
       GROUP BY r.id
       ORDER BY r.created_at DESC`, params
    );
    let list = rows.map(r => ({ ...r, status: calcStatus(r) }));
    if (status) list = list.filter(r => r.status === status);
    res.json(list);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar contas a receber' }); }
});

// GET /api/receivables/summary — aging 30/60/90 + alerta de atraso
router.get('/summary', auth, async (req, res) => {
  const params = [];
  let clinicSql = '';
  if (req.user.clinic_id) { params.push(req.user.clinic_id); clinicSql = `AND r.clinic_id = $${params.length}`; }
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento >= CURRENT_DATE AND p.vencimento <  CURRENT_DATE + 30), 0) AS a_vencer_30,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento >= CURRENT_DATE + 30 AND p.vencimento < CURRENT_DATE + 60), 0) AS a_vencer_60,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento >= CURRENT_DATE + 60 AND p.vencimento < CURRENT_DATE + 90), 0) AS a_vencer_90,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento >= CURRENT_DATE + 90), 0)                                       AS a_vencer_90mais,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento <  CURRENT_DATE AND p.vencimento >= CURRENT_DATE - 30), 0)      AS vencido_30,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento <  CURRENT_DATE - 30 AND p.vencimento >= CURRENT_DATE - 60), 0) AS vencido_60,
         COALESCE(SUM(p.valor) FILTER (WHERE p.vencimento <  CURRENT_DATE - 60), 0)                                       AS vencido_60mais,
         COUNT(*) FILTER (WHERE p.vencimento < CURRENT_DATE)::int AS parcelas_vencidas,
         COALESCE(SUM(p.valor), 0) AS total_aberto
       FROM receivable_parcelas p
       JOIN receivables r ON r.id = p.receivable_id
       WHERE p.pago = FALSE ${clinicSql}`, params
    );
    const s = rows[0];
    res.json({ ...s, tem_atraso: s.parcelas_vencidas > 0 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro no resumo' }); }
});

// PATCH /api/receivables/parcelas/:id/pagar  (body: { pago: true|false })
router.patch('/parcelas/:id/pagar', auth, async (req, res) => {
  const pago = req.body.pago !== false;
  try {
    const { rows } = await pool.query(
      `UPDATE receivable_parcelas SET pago=$1, pago_em=$2 WHERE id=$3 RETURNING *`,
      [pago, pago ? new Date().toISOString().slice(0, 10) : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Parcela não encontrada' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar parcela' }); }
});

// DELETE /api/receivables/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM receivables WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao excluir título' }); }
});

module.exports = router;
module.exports.upsertReceivable = upsertReceivable;
