const express = require('express');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { sendConfirmation, sendCancellation } = require('../services/whatsapp');
const router = express.Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://psaude.ia.br';

const formatDate = (d) => {
  const dt = new Date(d);
  return dt.toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  });
};

const emailLayout = (content) => `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
    <div style="background: #1a2535; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <div style="font-size: 22px; font-weight: 800; color: #4DB8E8; letter-spacing: 0.5px;">P. Soluções</div>
      <div style="font-size: 13px; font-weight: 600; color: #E8841A; letter-spacing: 1px;">para Saúde</div>
    </div>
    <div style="background: #fff; border: 1px solid #e9ecef; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
      ${content}
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0;" />
      <p style="color: #adb5bd; font-size: 11px; text-align: center; margin: 0;">
        P. Soluções para Saúde · Sistema de Gestão Clínica
      </p>
    </div>
  </div>
`;

// List appointments
router.get('/', auth, async (req, res) => {
  try {
    const { start, end, professional_id, room_id } = req.query;
    const clinic_id = req.user.clinic_id;
    const params = [];
    const conditions = ['1=1'];

    if (clinic_id) { conditions.push(`a.clinic_id = $${params.length+1}`); params.push(clinic_id); }
    else { return res.json([]); }
    if (start) { conditions.push(`a.appointment_date >= $${params.length+1}`); params.push(start); }
    if (end) { conditions.push(`a.appointment_date <= $${params.length+1}`); params.push(end); }
    if (professional_id) { conditions.push(`a.professional_id = $${params.length+1}`); params.push(professional_id); }
    if (room_id) { conditions.push(`a.room_id = $${params.length+1}`); params.push(room_id); }

    const query = `
      SELECT a.*, p.name as patient_name, p.cpf as patient_cpf, p.email as patient_email,
             pr.name as professional_name, pr.type as professional_type,
             r.name as room_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN professionals pr ON a.professional_id = pr.id
      LEFT JOIN rooms r ON a.room_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.appointment_date`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create appointment
router.post('/', auth, async (req, res) => {
  const { type, patient_id, professional_id, room_id, appointment_date, duration_minutes, notes } = req.body;
  if (!type || !patient_id || !professional_id || !appointment_date)
    return res.status(400).json({ error: 'Tipo, paciente, profissional e data são obrigatórios' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de agendar' });

  try {
    // Busca dados do paciente, profissional e clínica
    const [patientRes, clinicRes, profRes] = await Promise.all([
      pool.query('SELECT name, email, phone FROM patients WHERE id = $1', [patient_id]),
      pool.query(`SELECT name, email, email_confirmations,
                         whatsapp_enabled, whatsapp_confirm, whatsapp_token
                  FROM clinics WHERE id = $1`, [clinic_id]),
      pool.query('SELECT name FROM professionals WHERE id = $1', [professional_id]),
    ]);
    const patient = patientRes.rows[0];
    const clinic = clinicRes.rows[0];
    const professional = profRes.rows[0];

    // Gera tokens de confirmação e cancelamento
    const confirmToken = crypto.randomBytes(24).toString('hex');
    const cancelToken = crypto.randomBytes(24).toString('hex');

    const result = await pool.query(
      `INSERT INTO appointments
         (type, patient_id, professional_id, room_id, clinic_id, appointment_date,
          duration_minutes, notes, status, confirmation_token, cancel_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_confirmation',$9,$10) RETURNING *`,
      [type, patient_id, professional_id, room_id || null, clinic_id, appointment_date,
       duration_minutes || 30, notes, confirmToken, cancelToken]
    );
    const apt = result.rows[0];

    // Envia e-mail de confirmação se: clínica habilitou + paciente tem e-mail + não é trial
    if (!req.user?.is_trial && clinic?.email_confirmations && patient?.email) {
      const confirmLink = `${FRONTEND_URL}/appointment/respond?token=${confirmToken}&action=confirm`;
      const cancelLink = `${FRONTEND_URL}/appointment/respond?token=${cancelToken}&action=cancel`;
      const dateStr = formatDate(appointment_date);

      await resend.emails.send({
        from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
        to: patient.email,
        subject: `Consulta agendada — ${clinic.name}`,
        html: emailLayout(`
          <h2 style="margin: 0 0 8px; font-size: 18px; color: #1a2535;">Olá, ${patient.name}!</h2>
          <p style="color: #495057; font-size: 14px; line-height: 1.6;">
            Sua consulta foi agendada com sucesso em <strong>${clinic.name}</strong>.
          </p>
          <div style="background: #f8f9fa; border-left: 4px solid #4DB8E8; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #495057;">
              📅 <strong>${dateStr}</strong>
            </p>
          </div>
          <p style="color: #495057; font-size: 14px; line-height: 1.6;">
            Por favor, confirme sua presença clicando no botão abaixo:
          </p>
          <div style="text-align: center; margin: 24px 0; display: flex; gap: 12px; justify-content: center;">
            <a href="${confirmLink}" style="background:#28a745;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">✓ Confirmar presença</a>
            <a href="${cancelLink}" style="background:#dc3545;color:white;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">✗ Cancelar consulta</a>
          </div>
        `)
      }).catch(e => console.error('Erro e-mail confirmação:', e.message));
    }

    // WhatsApp: confirmação de agendamento (bloqueado para trial)
    if (!req.user?.is_trial && clinic?.whatsapp_enabled && clinic?.whatsapp_confirm &&
        clinic?.whatsapp_token && patient?.phone) {
      const dateStr = new Date(appointment_date).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
      });
      sendConfirmation({
        apiToken: clinic.whatsapp_token,
        patientName: patient.name,
        patientPhone: patient.phone,
        professionalName: professional?.name || 'profissional',
        clinicName: clinic.name,
        dateStr
      }).catch(e => console.error('[WhatsApp] Erro confirmação:', e.message));
    }

    res.status(201).json(apt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update appointment
router.put('/:id', auth, async (req, res) => {
  const { type, patient_id, professional_id, room_id, appointment_date, duration_minutes, notes, status } = req.body;
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      `UPDATE appointments SET type=$1, patient_id=$2, professional_id=$3, room_id=$4,
       appointment_date=$5, duration_minutes=$6, notes=$7, status=$8
       WHERE id=$9 AND clinic_id=$10 RETURNING *`,
      [type, patient_id, professional_id, room_id || null, appointment_date,
       duration_minutes || 30, notes, status || 'pending_confirmation', req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete appointment
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Consulta não encontrada' });
    res.json({ message: 'Consulta removida' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint público — paciente confirma ou cancela via token (sem autenticação)
router.get('/respond', async (req, res) => {
  const { token, action } = req.query;
  if (!token || !['confirm', 'cancel'].includes(action))
    return res.status(400).json({ error: 'Parâmetros inválidos' });

  try {
    const column = action === 'confirm' ? 'confirmation_token' : 'cancel_token';
    const aptRes = await pool.query(
      `SELECT a.*, p.name as patient_name, p.email as patient_email, p.phone as patient_phone,
              pr.name as professional_name,
              c.name as clinic_name, c.email as clinic_email, c.email_confirmations,
              c.whatsapp_enabled, c.whatsapp_cancel, c.whatsapp_token
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN professionals pr ON a.professional_id = pr.id
       LEFT JOIN clinics c ON a.clinic_id = c.id
       WHERE a.${column} = $1`,
      [token]
    );

    if (!aptRes.rows[0])
      return res.status(404).json({ error: 'Link inválido ou já utilizado.' });

    const apt = aptRes.rows[0];

    if (['confirmed', 'cancelled'].includes(apt.status))
      return res.json({ message: apt.status === 'confirmed' ? 'Consulta já confirmada!' : 'Consulta já cancelada.', status: apt.status });

    if (action === 'confirm') {
      await pool.query(
        `UPDATE appointments SET status='confirmed', confirmed_at=NOW() WHERE id=$1`,
        [apt.id]
      );
      return res.json({ message: 'Consulta confirmada com sucesso! Até lá.', status: 'confirmed' });
    }

    if (action === 'cancel') {
      await pool.query(
        `UPDATE appointments SET status='cancelled' WHERE id=$1`,
        [apt.id]
      );

      // Notifica a clínica por e-mail
      if (apt.clinic_email) {
        const dateStr = formatDate(apt.appointment_date);
        await resend.emails.send({
          from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
          to: apt.clinic_email,
          subject: `Cancelamento de consulta — ${apt.patient_name}`,
          html: emailLayout(`
            <h2 style="margin: 0 0 8px; font-size: 18px; color: #dc3545;">⚠️ Consulta Cancelada</h2>
            <p style="color: #495057; font-size: 14px; line-height: 1.6;">
              O paciente <strong>${apt.patient_name}</strong> cancelou a consulta agendada para:
            </p>
            <div style="background: #fff5f5; border-left: 4px solid #dc3545; padding: 16px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #495057;">
                📅 <strong>${dateStr}</strong><br/>
                👨‍⚕️ Profissional: ${apt.professional_name}
              </p>
            </div>
            <p style="color: #868e96; font-size: 13px;">
              Acesse o sistema para reagendar ou remover o horário.
            </p>
          `)
        }).catch(e => console.error('Erro e-mail cancelamento clínica:', e.message));
      }

      // WhatsApp: aviso de cancelamento ao paciente
      if (apt.whatsapp_enabled && apt.whatsapp_cancel &&
          apt.whatsapp_token && apt.patient_phone) {
        const dateStr = formatDate(apt.appointment_date);
        sendCancellation({
          apiToken: apt.whatsapp_token,
          patientName: apt.patient_name,
          patientPhone: apt.patient_phone,
          professionalName: apt.professional_name,
          clinicName: apt.clinic_name,
          dateStr
        }).catch(e => console.error('[WhatsApp] Erro cancelamento:', e.message));
      }

      return res.json({ message: 'Consulta cancelada. A clínica foi notificada.', status: 'cancelled' });
    }
  } catch (err) {
    console.error('Erro respond:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;
