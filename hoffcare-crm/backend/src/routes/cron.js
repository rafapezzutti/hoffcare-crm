const express = require('express');
const { Resend } = require('resend');
const pool = require('../config/db');
const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://psaude.ia.br';
const CRON_SECRET = process.env.CRON_SECRET || 'psaude-cron-secret';

const formatDate = (d) =>
  new Date(d).toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  });

const emailLayout = (content) => `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
    <div style="background: #1a2535; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <div style="font-size: 22px; font-weight: 800; color: #4DB8E8;">P. Soluções</div>
      <div style="font-size: 13px; font-weight: 600; color: #E8841A;">para Saúde</div>
    </div>
    <div style="background:#fff;border:1px solid #e9ecef;border-top:none;padding:32px;border-radius:0 0 8px 8px;">
      ${content}
      <hr style="border:none;border-top:1px solid #e9ecef;margin:24px 0;"/>
      <p style="color:#adb5bd;font-size:11px;text-align:center;margin:0;">P. Soluções para Saúde · Sistema de Gestão Clínica</p>
    </div>
  </div>
`;

// Middleware: valida chave secreta do cron
const cronAuth = (req, res, next) => {
  const key = req.headers['x-cron-secret'] || req.query.secret;
  if (key !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// POST /api/cron/reminders — chamado pelo cron-job.org a cada hora
router.post('/reminders', cronAuth, async (req, res) => {
  const results = { reminders: 0, recalls: 0, errors: [] };

  try {
    // ── 1. LEMBRETES 24H ──────────────────────────────────────────────
    // Consultas entre agora+23h e agora+25h, não lembradas, não canceladas
    const upcoming = await pool.query(`
      SELECT a.*, p.name as patient_name, p.email as patient_email,
             pr.name as professional_name,
             c.name as clinic_name, c.email_reminders,
             a.confirmation_token, a.cancel_token
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN professionals pr ON a.professional_id = pr.id
      LEFT JOIN clinics c ON a.clinic_id = c.id
      WHERE a.appointment_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
        AND a.reminder_sent = false
        AND a.status NOT IN ('cancelled', 'completed')
        AND c.email_reminders = true
        AND p.email IS NOT NULL AND p.email != ''
    `);

    for (const apt of upcoming.rows) {
      try {
        const confirmLink = `${FRONTEND_URL}/appointment/respond?token=${apt.confirmation_token}&action=confirm`;
        const cancelLink  = `${FRONTEND_URL}/appointment/respond?token=${apt.cancel_token}&action=cancel`;
        const dateStr = formatDate(apt.appointment_date);

        await resend.emails.send({
          from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
          to: apt.patient_email,
          subject: `Lembrete: sua consulta é amanhã — ${apt.clinic_name}`,
          html: emailLayout(`
            <h2 style="margin:0 0 8px;font-size:18px;color:#1a2535;">Olá, ${apt.patient_name}!</h2>
            <p style="color:#495057;font-size:14px;line-height:1.6;">
              Este é um lembrete de que você tem uma consulta marcada para <strong>amanhã</strong>:
            </p>
            <div style="background:#f0f9ff;border-left:4px solid #4DB8E8;padding:16px;border-radius:4px;margin:20px 0;">
              <p style="margin:0;font-size:14px;color:#495057;">
                📅 <strong>${dateStr}</strong><br/>
                👨‍⚕️ ${apt.professional_name}<br/>
                🏥 ${apt.clinic_name}
              </p>
            </div>
            <p style="color:#495057;font-size:14px;">Confirme ou cancele sua presença:</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${confirmLink}" style="background:#28a745;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;margin:4px;">✓ Confirmar presença</a>
              <a href="${cancelLink}" style="background:#dc3545;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;margin:4px;">✗ Cancelar consulta</a>
            </div>
          `)
        });

        await pool.query('UPDATE appointments SET reminder_sent=true WHERE id=$1', [apt.id]);
        results.reminders++;
      } catch (e) {
        results.errors.push(`Lembrete apt#${apt.id}: ${e.message}`);
      }
    }

    // ── 2. RECALL 6 MESES ────────────────────────────────────────────
    // Pacientes cuja última consulta foi há 6 meses e não receberam recall
    const recallPatients = await pool.query(`
      SELECT DISTINCT ON (p.id)
        p.id, p.name, p.email, p.clinic_id,
        c.name as clinic_name, c.email_recall,
        MAX(a.appointment_date) as last_appointment
      FROM patients p
      JOIN appointments a ON a.patient_id = p.id
      JOIN clinics c ON p.clinic_id = c.id
      WHERE a.status NOT IN ('cancelled')
        AND c.email_recall = true
        AND p.email IS NOT NULL AND p.email != ''
        AND (p.recall_sent_at IS NULL OR p.recall_sent_at < NOW() - INTERVAL '6 months')
      GROUP BY p.id, p.name, p.email, p.clinic_id, c.name, c.email_recall
      HAVING MAX(a.appointment_date) < NOW() - INTERVAL '6 months'
         AND MAX(a.appointment_date) > NOW() - INTERVAL '7 months'
    `);

    for (const patient of recallPatients.rows) {
      try {
        await resend.emails.send({
          from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
          to: patient.email,
          subject: `Está na hora da sua consulta — ${patient.clinic_name}`,
          html: emailLayout(`
            <h2 style="margin:0 0 8px;font-size:18px;color:#1a2535;">Olá, ${patient.name}!</h2>
            <p style="color:#495057;font-size:14px;line-height:1.6;">
              Já se passaram <strong>6 meses</strong> desde a sua última consulta em
              <strong>${patient.clinic_name}</strong>.
            </p>
            <p style="color:#495057;font-size:14px;line-height:1.6;">
              Manter acompanhamento regular é essencial para sua saúde.
              Que tal agendar uma nova consulta?
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="https://psaude.ia.br" style="background:#4DB8E8;color:white;text-decoration:none;padding:13px 32px;border-radius:6px;font-size:15px;font-weight:700;display:inline-block;">
                Agendar consulta
              </a>
            </div>
            <p style="color:#868e96;font-size:12px;">
              Entre em contato com a clínica para marcar seu horário.
            </p>
          `)
        });

        await pool.query('UPDATE patients SET recall_sent_at=NOW() WHERE id=$1', [patient.id]);
        results.recalls++;
      } catch (e) {
        results.errors.push(`Recall paciente#${patient.id}: ${e.message}`);
      }
    }

    res.json({ ok: true, ...results, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
