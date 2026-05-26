const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Listar acertos da clínica
router.get('/', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  const { professional_id, month, year } = req.query;
  const params = [clinic_id];
  const conditions = ['s.clinic_id = $1'];

  if (professional_id) { conditions.push(`s.professional_id = $${params.length+1}`); params.push(professional_id); }
  if (year && month) {
    conditions.push(`EXTRACT(YEAR FROM s.date) = $${params.length+1}`); params.push(year);
    conditions.push(`EXTRACT(MONTH FROM s.date) = $${params.length+1}`); params.push(month);
  }

  try {
    const result = await pool.query(
      `SELECT s.*, p.name as professional_name
       FROM financial_settlements s
       LEFT JOIN professionals p ON s.professional_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar acerto
router.post('/', auth, async (req, res) => {
  const { professional_id, value, date, description, type, status } = req.body;
  if (!value || !date)
    return res.status(400).json({ error: 'Valor e data são obrigatórios' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  try {
    const result = await pool.query(
      `INSERT INTO financial_settlements (clinic_id, professional_id, value, date, description, type, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [clinic_id, professional_id || null, value, date, description || null,
       type || 'a_pagar', status || 'pendente']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar acerto
router.put('/:id', auth, async (req, res) => {
  const { professional_id, value, date, description, type, status } = req.body;
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      `UPDATE financial_settlements SET professional_id=$1, value=$2, date=$3,
       description=$4, type=$5, status=$6
       WHERE id=$7 AND clinic_id=$8 RETURNING *`,
      [professional_id || null, value, date, description || null,
       type || 'a_pagar', status || 'pendente', req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Acerto não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover acerto
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM financial_settlements WHERE id=$1 AND clinic_id=$2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Acerto não encontrado' });
    res.json({ message: 'Acerto removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extrato mensal por profissional
router.get('/statement/:professional_id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { professional_id } = req.params;
  const y = parseInt(req.query.year) || new Date().getFullYear();
  const m = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    const [profRes, recordsRes, settlementsRes, rentalsRes] = await Promise.all([
      // Dados do profissional
      pool.query(`SELECT p.*, c.name as clinic_name, c.email as clinic_email
                  FROM professionals p
                  LEFT JOIN clinics c ON c.id = $2
                  WHERE p.id = $1`, [professional_id, clinic_id]),

      // Registros/procedimentos do profissional no mês
      pool.query(`
        SELECT mr.consultation_date, mr.id as record_id,
               pat.name as patient_name,
               COALESCE(SUM(mrp.value), 0) as total_value,
               ARRAY_AGG(mrp.procedure_name ORDER BY mrp.id) FILTER (WHERE mrp.id IS NOT NULL) as procedures
        FROM medical_records mr
        LEFT JOIN patients pat ON pat.id = mr.patient_id
        LEFT JOIN medical_record_procedures mrp ON mrp.record_id = mr.id
        WHERE mr.clinic_id = $1 AND mr.professional_id = $2
          AND EXTRACT(YEAR FROM mr.consultation_date) = $3
          AND EXTRACT(MONTH FROM mr.consultation_date) = $4
        GROUP BY mr.id, mr.consultation_date, pat.name
        ORDER BY mr.consultation_date
      `, [clinic_id, professional_id, y, m]),

      // Acertos financeiros do mês
      pool.query(`
        SELECT * FROM financial_settlements
        WHERE clinic_id = $1 AND professional_id = $2
          AND EXTRACT(YEAR FROM date) = $3
          AND EXTRACT(MONTH FROM date) = $4
        ORDER BY date
      `, [clinic_id, professional_id, y, m]),

      // Aluguéis ativos no mês (proporcional)
      pool.query(`
        SELECT * FROM rentals
        WHERE clinic_id = $1 AND status = 'active'
          AND start_date <= $2::date
          AND (end_date IS NULL OR end_date >= $3::date)
        ORDER BY start_date
      `, [clinic_id, `${y}-${String(m).padStart(2,'0')}-28`, `${y}-${String(m).padStart(2,'0')}-01`]),
    ]);

    const professional = profRes.rows[0];
    if (!professional) return res.status(404).json({ error: 'Profissional não encontrado' });

    const records = recordsRes.rows;
    const settlements = settlementsRes.rows;
    const rentals = rentalsRes.rows;

    const totalRecordsGross = records.reduce((s, r) => s + parseFloat(r.total_value), 0);

    const repassePercent = professional.repasse_percentual != null
      ? parseFloat(professional.repasse_percentual)
      : 100; // sem repasse configurado = recebe 100%

    // a_pagar: clínica paga ao profissional → soma à base
    const totalSettlementsIn = settlements
      .filter(s => s.type === 'a_pagar')
      .reduce((s, r) => s + parseFloat(r.value), 0);

    // a_receber: profissional paga à clínica → subtrai da base
    const totalSettlementsOut = settlements
      .filter(s => s.type === 'a_receber')
      .reduce((s, r) => s + parseFloat(r.value), 0);

    const totalRentals = rentals.reduce((s, r) => s + parseFloat(r.value), 0);

    // Acertos entram ANTES do repasse %:
    // base = procedimentos + acertos da clínica − acertos do profissional
    // líquido = base × (repasse% / 100) − aluguéis
    const baseBeforeRepasse = totalRecordsGross + totalSettlementsIn - totalSettlementsOut;
    const totalAfterRepasse = baseBeforeRepasse * repassePercent / 100;
    const netTotal = totalAfterRepasse - totalRentals;

    res.json({
      professional,
      year: y,
      month: m,
      records,
      settlements,
      rentals,
      summary: {
        total_records_gross: totalRecordsGross,
        repasse_percent: repassePercent,
        total_settlements_in: totalSettlementsIn,
        total_settlements_out: totalSettlementsOut,
        base_before_repasse: baseBeforeRepasse,   // base antes de aplicar o %
        total_after_repasse: totalAfterRepasse,    // base × %
        total_records: totalAfterRepasse,          // alias para compatibilidade com o frontend
        total_rentals: totalRentals,
        net_total: netTotal,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar extrato por email
router.post('/statement/:professional_id/send-email', auth, async (req, res) => {
  const { html, year, month, professional_name, professional_email } = req.body;
  if (!professional_email) return res.status(400).json({ error: 'Profissional não tem email cadastrado' });

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  try {
    await resend.emails.send({
      from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
      to: professional_email,
      subject: `Extrato Financeiro — ${MONTHS[month - 1]}/${year}`,
      html,
    });
    res.json({ message: 'Email enviado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar email: ' + err.message });
  }
});

module.exports = router;
