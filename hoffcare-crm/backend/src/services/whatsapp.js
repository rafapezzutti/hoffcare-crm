const axios = require('axios');

const ZAPI_BASE = 'https://api.z-api.io/instances';

/**
 * Normaliza número para Z-API: só dígitos, com DDI 55
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Envia mensagem de texto simples via Z-API
 */
async function sendText(instanceId, token, phone, message) {
  const number = normalizePhone(phone);
  try {
    const res = await axios.post(
      `${ZAPI_BASE}/${instanceId}/token/${token}/send-text`,
      { phone: number, message },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return { ok: true, data: res.data };
  } catch (err) {
    console.error('[Z-API] Erro ao enviar mensagem:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
}

/**
 * Confirmação de agendamento
 */
async function sendConfirmation({ instanceId, token, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! 👋\n\n` +
    `✅ Sua consulta foi agendada com sucesso.\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Qualquer dúvida, entre em contato conosco.`;
  return sendText(instanceId, token, patientPhone, message);
}

/**
 * Lembrete de consulta
 */
async function sendReminder({ instanceId, token, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! ⏰\n\n` +
    `Lembramos que você tem consulta em breve:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Até logo!`;
  return sendText(instanceId, token, patientPhone, message);
}

/**
 * Aviso de cancelamento
 */
async function sendCancellation({ instanceId, token, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*.\n\n` +
    `❌ Sua consulta foi cancelada:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Entre em contato para reagendar.`;
  return sendText(instanceId, token, patientPhone, message);
}

module.exports = { sendConfirmation, sendReminder, sendCancellation, sendText };
