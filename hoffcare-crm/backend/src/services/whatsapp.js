const axios = require('axios');

const SOCIALHUB_API = 'https://apinew.socialhub.pro/api/sendMessage';

/**
 * Normaliza número: só dígitos, com DDI 55
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Envia mensagem de texto via SocialHub API (multipart/form-data)
 * @param {string} apiToken - token da integração (gerado no painel SocialHub)
 * @param {string} phone    - número do destinatário
 * @param {string} message  - texto da mensagem
 */
async function sendText(apiToken, phone, message) {
  const number = normalizePhone(phone);

  // FormData nativo do Node 18+ (sem dependência externa)
  const form = new FormData();
  form.append('api_token', apiToken);
  form.append('phone', number);
  form.append('message', message);

  try {
    const res = await axios.post(SOCIALHUB_API, form, { timeout: 15000 });
    return { ok: true, data: res.data };
  } catch (err) {
    console.error('[SocialHub] Erro ao enviar mensagem:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
}

/**
 * Confirmação de agendamento
 */
async function sendConfirmation({ apiToken, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! 👋\n\n` +
    `✅ Sua consulta foi agendada com sucesso.\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Qualquer dúvida, entre em contato conosco.`;
  return sendText(apiToken, patientPhone, message);
}

/**
 * Lembrete de consulta
 */
async function sendReminder({ apiToken, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! ⏰\n\n` +
    `Lembramos que você tem consulta em breve:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Até logo!`;
  return sendText(apiToken, patientPhone, message);
}

/**
 * Aviso de cancelamento
 */
async function sendCancellation({ apiToken, patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*.\n\n` +
    `❌ Sua consulta foi cancelada:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Entre em contato para reagendar.`;
  return sendText(apiToken, patientPhone, message);
}

module.exports = { sendConfirmation, sendReminder, sendCancellation, sendText };
