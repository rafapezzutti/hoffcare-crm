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
 * Usa fetch nativo (Node 18+) para garantir compatibilidade com FormData
 */
async function sendText(apiToken, phone, message) {
  const number = normalizePhone(phone);

  const form = new FormData();
  form.append('api_token', apiToken.trim());
  form.append('phone', number);
  form.append('message', message);

  try {
    const res = await fetch(SOCIALHUB_API, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    console.log('[SocialHub] Resposta:', JSON.stringify(data));
    if (data.success === false) {
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (err) {
    console.error('[SocialHub] Erro ao enviar mensagem:', err.message);
    return { ok: false, error: err.message };
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
