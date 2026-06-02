const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/anthropometry?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const result = await pool.query(
      `SELECT * FROM patient_anthropometry WHERE patient_id=$1 AND clinic_id=$2
       ORDER BY eval_date ASC`,
      [patient_id, req.user.clinic_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anthropometry
router.post('/', auth, async (req, res) => {
  const { patient_id, eval_date, weight, height, body_fat_pct, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });

  // Calcular IMC automaticamente se peso e altura informados
  let imc = null;
  if (weight && height) {
    const heightM = height / 100;
    imc = +(weight / (heightM * heightM)).toFixed(2);
  }

  try {
    const result = await pool.query(
      `INSERT INTO patient_anthropometry (patient_id, clinic_id, eval_date, weight, height, imc, body_fat_pct, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [patient_id, req.user.clinic_id, eval_date || new Date().toISOString().slice(0,10),
       weight || null, height || null, imc, body_fat_pct || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/anthropometry/:id
router.put('/:id', auth, async (req, res) => {
  const { eval_date, weight, height, body_fat_pct, notes } = req.body;
  let imc = null;
  if (weight && height) {
    const heightM = height / 100;
    imc = +(weight / (heightM * heightM)).toFixed(2);
  }
  try {
    const result = await pool.query(
      `UPDATE patient_anthropometry SET eval_date=$1, weight=$2, height=$3, imc=$4, body_fat_pct=$5, notes=$6
       WHERE id=$7 AND clinic_id=$8 RETURNING *`,
      [eval_date, weight || null, height || null, imc, body_fat_pct || null, notes || null,
       req.params.id, req.user.clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/anthropometry/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM patient_anthropometry WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anthropometry/send-report — envia PDF por e-mail
router.post('/send-report', auth, async (req, res) => {
  // Usuários trial não podem enviar e-mails
  if (req.user.is_trial) {
    return res.status(403).json({ error: 'Envio de e-mail bloqueado para usuários em período trial.' });
  }

  const { patient_id } = req.body;
  try {
    const patientRes = await pool.query('SELECT name, email FROM patients WHERE id=$1', [patient_id]);
    const patient = patientRes.rows[0];
    if (!patient?.email) return res.status(400).json({ error: 'Paciente sem e-mail cadastrado' });

    const records = await pool.query(
      `SELECT * FROM patient_anthropometry WHERE patient_id=$1 AND clinic_id=$2 ORDER BY eval_date ASC`,
      [patient_id, req.user.clinic_id]
    );
    const clinicRes = await pool.query('SELECT name FROM clinics WHERE id=$1', [req.user.clinic_id]);
    const clinic = clinicRes.rows[0];

    const rows = records.rows.map(r =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${new Date(r.eval_date).toLocaleDateString('pt-BR')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.weight ? r.weight + ' kg' : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.height ? r.height + ' cm' : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.imc || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.body_fat_pct ? r.body_fat_pct + '%' : '—'}</td>
      </tr>`
    ).join('');

    const { Resend } = require('resend');
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'P. Soluções para Saúde <noreply@psaude.ia.br>',
      to: patient.email,
      subject: `${clinic?.name || 'P. Soluções para Saúde'} — Relatório de Evolução Física`,
      html: `
        <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:24px">
          <h2 style="color:#4DB8E8">Relatório de Evolução Física</h2>
          <p>Olá, <strong>${patient.name}</strong>!</p>
          <p>Confira abaixo o histórico das suas avaliações antropométricas em ${clinic?.name || 'nossa clínica'}:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#4DB8E8;color:#fff">
                <th style="padding:10px;text-align:left">Data</th>
                <th style="padding:10px;text-align:center">Peso</th>
                <th style="padding:10px;text-align:center">Altura</th>
                <th style="padding:10px;text-align:center">IMC</th>
                <th style="padding:10px;text-align:center">% Gordura</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#666;font-size:12px;margin-top:24px">
            Este relatório foi gerado automaticamente por ${clinic?.name || 'P. Soluções para Saúde'}.
          </p>
        </div>
      `,
    });

    res.json({ ok: true, message: `Relatório enviado para ${patient.email}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
