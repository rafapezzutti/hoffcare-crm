/**
 * WhatsApp via Evolution API (self-hosted, open-source)
 * Credenciais globais — número da Pezzutti Soluções compartilhado entre todos os CRMs.
 *
 * Env vars necessárias:
 *   EVO_API_URL      = https://evo-api.onrender.com  (URL do serviço no Render)
 *   EVO_API_KEY      = <chave gerada no Render>       (AUTHENTICATION_API_KEY)
 *   EVO_INSTANCE     = pezzutti                       (nome da instância criada)
 */

const EVO_API_URL  = process.env.EVO_API_URL;
const EVO_API_KEY  = process.env.EVO_API_KEY;
const EVO_INSTANCE = process.env.EVO_INSTANCE || 'pezzutti';

/**
 * Normaliza número: só dígitos, com DDI 55
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Envia mensagem de texto via Evolution API
 * POST /message/sendText/{instance}
 * Header: apikey
 * Body:   { number, text }
 */
async function sendText(phone, message) {
  if (!EVO_API_URL || !EVO_API_KEY) {
    console.error('[WhatsApp] EVO_API_URL ou EVO_API_KEY não configurados.');
    return { ok: false, error: 'Evolution API não configurada no servidor.' };
  }

  const number = normalizePhone(phone);
  const url = `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_API_KEY,
      },
      body: JSON.stringify({ number, text: message }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    console.log('[Evolution API] Resposta:', JSON.stringify(data));

    // Sucesso: retorna objeto com .key.id ou .status
    if (data.key?.id || data.status) {
      return { ok: true, data };
    }
    return { ok: false, error: data };
  } catch (err) {
    console.error('[Evolution API] Erro ao enviar mensagem:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Retorna QR code base64 para conexão da instância
 * Usado pela rota admin de setup
 */
async function getQRCode() {
  if (!EVO_API_URL || !EVO_API_KEY) return { ok: false, error: 'Não configurado.' };
  try {
    const res = await fetch(`${EVO_API_URL}/instance/connect/${EVO_INSTANCE}`, {
      headers: { 'apikey': EVO_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Retorna o estado da conexão da instância
 */
async function getConnectionState() {
  if (!EVO_API_URL || !EVO_API_KEY) return { ok: false, error: 'Não configurado.' };
  try {
    const res = await fetch(`${EVO_API_URL}/instance/connectionState/${EVO_INSTANCE}`, {
      headers: { 'apikey': EVO_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Confirmação de agendamento
 */
async function sendConfirmation({ patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! 👋\n\n` +
    `✅ Sua consulta foi agendada com sucesso.\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Qualquer dúvida, entre em contato conosco.`;
  return sendText(patientPhone, message);
}

/**
 * Lembrete de consulta
 */
async function sendReminder({ patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*! ⏰\n\n` +
    `Lembramos que você tem consulta em breve:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Até logo!`;
  return sendText(patientPhone, message);
}

/**
 * Aviso de cancelamento
 */
async function sendCancellation({ patientName, patientPhone, professionalName, clinicName, dateStr }) {
  const message =
    `Olá, *${patientName}*.\n\n` +
    `❌ Sua consulta foi cancelada:\n\n` +
    `📅 *Data:* ${dateStr}\n` +
    `👨‍⚕️ *Profissional:* ${professionalName}\n` +
    `🏥 *Local:* ${clinicName}\n\n` +
    `Entre em contato para reagendar.`;
  return sendText(patientPhone, message);
}

module.exports = { sendConfirmation, sendReminder, sendCancellation, sendText, getQRCode, getConnectionState };
