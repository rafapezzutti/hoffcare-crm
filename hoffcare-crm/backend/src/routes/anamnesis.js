const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// ── Banco de perguntas padrão (seed por clínica) ──────────────────────────────
const DEFAULT_QUESTIONS = [
  { question: 'Você tem alguma alergia a medicamentos?',                    category: 'geral' },
  { question: 'Faz uso contínuo de algum medicamento?',                    category: 'geral' },
  { question: 'Já foi submetido a alguma cirurgia?',                       category: 'geral' },
  { question: 'Tem histórico de doenças cardíacas?',                       category: 'geral' },
  { question: 'Tem diabetes?',                                             category: 'geral' },
  { question: 'É fumante?',                                                category: 'geral' },
  { question: 'Consome bebidas alcoólicas com frequência?',                category: 'geral' },
  { question: 'Está grávida ou há possibilidade de gravidez?',             category: 'geral' },
  { question: 'Tem histórico de pressão alta?',                            category: 'geral' },
  { question: 'Há alguma condição de saúde que o médico deva saber?',      category: 'geral' },
  { question: 'Você tem alguma alergia a cosméticos ou produtos tópicos?', category: 'estetica' },
  { question: 'Já realizou algum procedimento estético anteriormente?',    category: 'estetica' },
  { question: 'Faz uso de ácidos ou retinóides?',                         category: 'estetica' },
  { question: 'Tem histórico de queloides ou cicatrizes hipertróficas?',   category: 'estetica' },
  { question: 'Tem acne ativa?',                                           category: 'estetica' },
  { question: 'Usa protetor solar diariamente?',                           category: 'estetica' },
  { question: 'Está em tratamento dermatológico?',                         category: 'estetica' },
  { question: 'Tem rosácea ou pele sensível?',                             category: 'estetica' },
  { question: 'Faz uso de anticoagulantes?',                              category: 'estetica' },
  { question: 'Tem alguma restrição a procedimentos invasivos?',           category: 'estetica' },
  { question: 'Tem alguma alergia a anestésicos?',                        category: 'odontologica' },
  { question: 'Faz uso de anticoagulantes?',                              category: 'odontologica' },
  { question: 'Tem problemas cardíacos?',                                  category: 'odontologica' },
  { question: 'Tem diabetes?',                                             category: 'odontologica' },
  { question: 'Tem pressão alta?',                                         category: 'odontologica' },
  { question: 'Já teve alguma reação adversa a procedimentos odontológicos?', category: 'odontologica' },
  { question: 'Tem bruxismo?',                                             category: 'odontologica' },
  { question: 'Usa aparelho ortodôntico?',                                 category: 'odontologica' },
  { question: 'Tem sensibilidade dentária?',                               category: 'odontologica' },
  { question: 'Está grávida?',                                             category: 'odontologica' },
];

async function ensureDefaults(clinicId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM anamnesis_questions WHERE clinic_id=$1 AND is_default=true',
    [clinicId]
  );
  if (parseInt(rows[0].count) === 0) {
    for (const q of DEFAULT_QUESTIONS) {
      await pool.query(
        `INSERT INTO anamnesis_questions (clinic_id, question, category, is_default) VALUES ($1,$2,$3,true)`,
        [clinicId, q.question, q.category]
      );
    }
  }
}

// GET /api/anamnesis/questions
router.get('/questions', auth, async (req, res) => {
  try {
    await ensureDefaults(req.user.clinic_id);
    const { rows } = await pool.query(
      `SELECT * FROM anamnesis_questions WHERE clinic_id=$1 ORDER BY category, is_default DESC, id`,
      [req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anamnesis/questions
router.post('/questions', auth, async (req, res) => {
  const { question, category } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Pergunta obrigatória' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO anamnesis_questions (clinic_id, question, category, is_default) VALUES ($1,$2,$3,false) RETURNING *`,
      [req.user.clinic_id, question.trim(), category || 'personalizada']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/anamnesis/questions/:id
router.delete('/questions/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM anamnesis_questions WHERE id=$1 AND clinic_id=$2 AND is_default=false',
      [req.params.id, req.user.clinic_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/anamnesis?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const result = await pool.query(
      `SELECT a.*, p.name as patient_name, p.email as patient_email
       FROM patient_anamnesis a JOIN patients p ON a.patient_id = p.id
       WHERE a.patient_id=$1 AND a.clinic_id=$2 ORDER BY a.created_at DESC`,
      [patient_id, req.user.clinic_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/anamnesis/form/:token — público
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

// POST /api/anamnesis/form/:token — paciente responde
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

// POST /api/anamnesis — criar anamnese
router.post('/', auth, async (req, res) => {
  const { patient_id, selected_questions, send_email } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  if (!selected_questions?.length) return res.status(400).json({ error: 'Selecione ao menos uma pergunta' });

  try {
    const patientRes = await pool.query('SELECT name, email FROM patients WHERE id=$1', [patient_id]);
    const patient = patientRes.rows[0];
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const clinicRes = await pool.query('SELECT name FROM clinics WHERE id=$1', [req.user.clinic_id]);
    const clinic = clinicRes.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(
      `INSERT INTO patient_anamnesis (patient_id, clinic_id, token, specialty, custom_questions, status)
       VALUES ($1,$2,$3,'personalizada',$4,'pending') RETURNING *`,
      [patient_id, req.user.clinic_id, token, JSON.stringify(selected_questions)]
    );
    const anamnesis = result.rows[0];
    const formUrl = `${process.env.FRONTEND_URL || 'https://psaude.ia.br'}/anamnesis/form/${token}`;

    if (send_email && req.user.is_trial) {
      return res.status(200).json({ ...anamnesis, warning: 'Envio de e-mail bloqueado para usuários trial.', formUrl });
    }

    if (send_email && patient.email) {
      try {
        const { Resend } = require('resend');
        const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'P. Soluções para Saúde <noreply@psaude.ia.br>',
          to: patient.email,
          subject: `${clinic?.name || 'Clínica'} — Preencha sua Anamnese`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#4DB8E8">Anamnese Digital</h2>
              <p>Olá, <strong>${patient.name}</strong>!</p>
              <p>${clinic?.name || 'Nossa clínica'} preparou um formulário de anamnese para você preencher antes da sua consulta.</p>
              <a href="${formUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#4DB8E8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
                Preencher Anamnese
              </a>
              <p style="color:#666;font-size:12px">Link: ${formUrl}</p>
            </div>
          `,
        });
        await pool.query(`UPDATE patient_anamnesis SET status='sent', sent_at=NOW() WHERE id=$1`, [anamnesis.id]);
        anamnesis.status = 'sent';
      } catch (emailErr) {
        console.error('[Anamnese] Erro e-mail:', emailErr.message);
      }
    }

    res.status(201).json({ ...anamnesis, form_url: formUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Templates ─────────────────────────────────────────────────────────────────

async function ensureTemplatesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anamnesis_templates (
      id        SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL,
      name      VARCHAR(200) NOT NULL,
      questions JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensureTemplatesTable().catch(console.error);

// GET /api/anamnesis/templates
router.get('/templates', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM anamnesis_templates WHERE clinic_id=$1 ORDER BY name',
      [req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/anamnesis/templates
router.post('/templates', auth, async (req, res) => {
  const { name, questions } = req.body;
  if (!name?.trim())       return res.status(400).json({ error: 'Nome obrigatório' });
  if (!questions?.length)  return res.status(400).json({ error: 'Selecione ao menos uma pergunta' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO anamnesis_templates (clinic_id, name, questions) VALUES ($1,$2,$3) RETURNING *',
      [req.user.clinic_id, name.trim(), JSON.stringify(questions)]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/anamnesis/templates/:id
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM anamnesis_templates WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/anamnesis/:id/fill — profissional preenche presencialmente
router.put('/:id/fill', auth, async (req, res) => {
  const { responses } = req.body;
  try {
    const r = await pool.query(
      'SELECT id, status FROM patient_anamnesis WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Anamnese não encontrada' });
    if (r.rows[0].status === 'completed') return res.status(400).json({ error: 'Anamnese já preenchida' });
    await pool.query(
      `UPDATE patient_anamnesis SET responses=$1, status='completed', completed_at=NOW() WHERE id=$2`,
      [JSON.stringify(responses || {}), req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/anamnesis/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM patient_anamnesis WHERE id=$1 AND clinic_id=$2', [req.params.id, req.user.clinic_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
