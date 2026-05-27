const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Perguntas padrão por especialidade
const DEFAULT_QUESTIONS = {
  geral: [
    'Você tem alguma alergia a medicamentos?',
    'Faz uso contínuo de algum medicamento?',
    'Já foi submetido a alguma cirurgia?',
    'Tem histórico de doenças cardíacas?',
    'Tem diabetes?',
    'É fumante?',
    'Consome bebidas alcoólicas com frequência?',
    'Está grávida ou há possibilidade de gravidez?',
    'Tem histórico de pressão alta?',
    'Há alguma condição de saúde que o médico deva saber?',
  ],
  estetica: [
    'Você tem alguma alergia a cosméticos ou produtos tópicos?',
    'Já realizou algum procedimento estético anteriormente?',
    'Faz uso de ácidos ou retinóides?',
    'Tem histórico de queloides ou cicatrizes hipertróficas?',
    'Tem acne ativa?',
    'Usa protetor solar diariamente?',
    'Está em tratamento dermatológico?',
    'Tem rosácea ou pele sensível?',
    'Faz uso de anticoagulantes?',
    'Tem alguma restrição a procedimentos invasivos?',
  ],
  odontologica: [
    'Tem alguma alergia a anestésicos?',
    'Faz uso de anticoagulantes?',
    'Tem problemas cardíacos?',
    'Tem diabetes?',
    'Tem pressão alta?',
    'Já teve alguma reação adversa a procedimentos odontológicos?',
    'Tem bruxismo?',
    'Usa aparelho ortodôntico?',
    'Tem sensibilidade dentária?',
    'Está grávida?',
  ],
};

// GET /api/anamnesis?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const result = await pool.query(
      `SELECT a.*, p.name as patient_name, p.email as patient_email
       FROM patient_anamnesis a JOIN patients p ON a.patient_id = p.id
       WHERE a.patient_id=$1 AND a.clinic_id=$2
       ORDER BY a.created_at DESC`,
      [patient_id, req.user.clinic_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/anamnesis/form/:token — público, para o paciente preencher
router.get('/form/:token', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.*, p.name as patient_name, c.name as clinic_name
       FROM patient_anamnesis a
       JOIN patients p ON a.patient_id = p.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.token=$1`,
      [req.params.token]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Formulário não encontrado ou link inválido' });
    if (r.rows[0].status === 'completed') return res.json({ completed: true, patient_name: r.rows[0].patient_name });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anamnesis/form/:token — paciente envia respostas
router.post('/form/:token', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, status FROM patient_anamnesis WHERE token=$1', [req.params.token]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Formulário não encontrado' });
    if (r.rows[0].status === 'completed') return res.status(400).json({ error: 'Formulário já preenchido' });

    await pool.query(
      `UPDATE patient_anamnesis SET responses=$1, status='completed', completed_at=NOW() WHERE token=$2`,
      [JSON.stringify(req.body.responses || {}), req.params.token]
    );
    res.json({ ok: true, message: 'Anamnese registrada com sucesso!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anamnesis — criar e enviar anamnese
router.post('/', auth, async (req, res) => {
  const { patient_id, specialty, custom_questions, send_email } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });

  try {
    const patientRes = await pool.query('SELECT name, email FROM patients WHERE id=$1', [patient_id]);
    const patient = patientRes.rows[0];
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const clinicRes = await pool.query('SELECT name, email FROM clinics WHERE id=$1', [req.user.clinic_id]);
    const clinic = clinicRes.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const questions = custom_questions?.length > 0
      ? custom_questions
      : DEFAULT_QUESTIONS[specialty || 'geral'] || DEFAULT_QUESTIONS.geral;

    const result = await pool.query(
      `INSERT INTO patient_anamnesis (patient_id, clinic_id, token, specialty, custom_questions, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [patient_id, req.user.clinic_id, token, specialty || 'geral', JSON.stringify(questions)]
    );

    const anamnesis = result.rows[0];
    const formUrl = `${process.env.FRONTEND_URL || 'https://psaude.ia.br'}/anamnesis/form/${token}`;

    // Usuários trial não podem enviar e-mails
    if (send_email && req.user.is_trial) {
      return res.status(200).json({ ...anamnesis, warning: 'Envio de e-mail bloqueado para usuários trial.', formUrl });
    }

    // Envio de e-mail via Resend se solicitado e paciente tiver email
    if (send_email && patient.email) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'P. Soluções para Saúde <noreply@psaude.ia.br>',
          to: patient.email,
          subject: `${clinic?.name || 'P. Soluções para Saúde'} — Preencha sua Anamnese`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#4DB8E8">Anamnese Digital</h2>
              <p>Olá, <strong>${patient.name}</strong>!</p>
              <p>${clinic?.name || 'Nossa clínica'} preparou um formulário de anamnese para você preencher antes da sua consulta.</p>
              <p>Clique no botão abaixo para responder:</p>
              <a href="${formUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#4DB8E8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
                Preencher Anamnese
              </a>
              <p style="color:#666;font-size:12px">Se o botão não funcionar, copie e cole este link no seu navegador:<br>${formUrl}</p>
            </div>
          `,
        });
        await pool.query(
          `UPDATE patient_anamnesis SET status='sent', sent_at=NOW() WHERE id=$1`,
          [anamnesis.id]
        );
        anamnesis.status = 'sent';
      } catch (emailErr) {
        console.error('[Anamnese] Erro ao enviar e-mail:', emailErr.message);
      }
    }

    res.status(201).json({ ...anamnesis, form_url: formUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/anamnesis/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM patient_anamnesis WHERE id=$1 AND clinic_id=$2', [req.params.id, req.user.clinic_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/anamnesis/defaults — retorna perguntas padrão por especialidade
router.get('/defaults', auth, (req, res) => {
  res.json(DEFAULT_QUESTIONS);
});

module.exports = router;
