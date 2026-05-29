const pool = require('../config/db');

const TYPE_LABELS = {
  appointment_confirmation: 'Confirmação de agendamento',
  appointment_reminder:     'Lembrete de consulta',
  appointment_cancellation: 'Aviso de cancelamento',
  anamnesis_link:           'Link de anamnese',
  trial_warning:            'Aviso de trial expirando',
  password_reset:           'Redefinição de senha',
  professional_statement:   'Extrato mensal profissional',
  test:                     'Mensagem de teste',
};

async function logMessage({ clinic_id, user_id, channel, type, recipient_phone, recipient_email, status = 'sent' }) {
  try {
    await pool.query(
      `INSERT INTO message_log (clinic_id, user_id, channel, type, type_label, recipient_phone, recipient_email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [clinic_id || null, user_id || null, channel, type, TYPE_LABELS[type] || type,
       recipient_phone || null, recipient_email || null, status]
    );
  } catch (err) {
    console.error('[MessageLog] Erro ao registrar:', err.message);
  }
}

module.exports = { logMessage, TYPE_LABELS };
