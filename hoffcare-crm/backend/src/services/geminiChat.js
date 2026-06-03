/**
 * geminiChat.js
 * Serviço de chat com o Gemini para o recurso "Talk to Me".
 * Suporta texto, imagens (base64) e áudio (base64).
 */

const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const MODEL = process.env.VERTEX_MODEL || 'gemini-1.5-flash';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente inteligente integrado ao HoffCare, um CRM médico e odontológico brasileiro.
Você auxilia profissionais de saúde com dúvidas clínicas, administrativas e operacionais do dia a dia.

IDIOMA: Sempre responda em português brasileiro. Seja direto, cordial e profissional.

AÇÕES DISPONÍVEIS:
Quando o profissional pedir para realizar uma das ações abaixo, inclua um campo "action" na sua resposta JSON:

- Criar novo paciente → type: "patient_new", prefill: { name, cpf, birthdate, phone, email }
- Buscar/abrir paciente → type: "patient_search", query: "nome ou CPF do paciente"
- Criar novo prontuário → type: "record_new", patient_name: "nome do paciente" (se informado)
- Navegar para tela → type: "navigate", path: "/rota" (ex: /patients, /records, /calendar/daily)

FORMATO DE RESPOSTA:
Retorne SEMPRE um JSON válido no seguinte formato:
{
  "message": "Sua resposta em texto aqui.",
  "action": {
    "type": "patient_new" | "patient_search" | "record_new" | "navigate",
    "label": "Texto do botão de ação",
    "prefill": { "name": "...", "cpf": "...", "birthdate": "...", "phone": "...", "email": "..." },
    "query": "termo de busca",
    "path": "/rota",
    "patient_name": "nome do paciente"
  }
}

Se não houver ação, omita o campo "action":
{ "message": "Sua resposta aqui." }

Se o profissional enviar um áudio, transcreva-o e responda com base no conteúdo.
Se enviar uma imagem, analise-a e responda sobre o que vê.

CONTEXTO DO SISTEMA:
- Telas disponíveis: /patients (pacientes), /records (prontuários), /calendar/daily (agenda do dia), /calendar/monthly (agenda mensal), /professionals (profissionais), /procedures (procedimentos), /settlements (acertos financeiros)
- Para criar paciente: name (nome), cpf (somente dígitos), birthdate (YYYY-MM-DD), phone (somente dígitos), email
- Nunca invente dados de pacientes. Se precisar de informação, pergunte ao profissional.`;

// ── Funções auxiliares ────────────────────────────────────────────────────────

async function getTokens() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const authV  = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const authGL = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/generative-language'] });
  return {
    tokenV:  await authV.getAccessToken(),
    tokenGL: await authGL.getAccessToken(),
  };
}

function httpPost(hostname, path, body, accessToken, project) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': project,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(`${json.error.message} (code: ${json.error.code})`));
          resolve(json);
        } catch {
          reject(new Error(`Resposta inválida: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Monta partes multimodais de uma mensagem ──────────────────────────────────

function buildParts(msg) {
  const parts = [];

  if (msg.text) parts.push({ text: msg.text });

  if (Array.isArray(msg.images)) {
    for (const img of msg.images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
    }
  }

  if (msg.audio) {
    parts.push({ inline_data: { mime_type: msg.audio.mimeType || 'audio/webm', data: msg.audio.data } });
  }

  return parts;
}

// ── Chat principal ─────────────────────────────────────────────────────────────

/**
 * Envia uma conversa ao Gemini e retorna { message, action? }.
 *
 * @param {Array} history  — histórico de mensagens: [{ role: 'user'|'model', text, images?, audio? }]
 * @returns {{ message: string, action?: object }}
 */
async function chat(history) {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_CREDENTIALS_JSON não configurado.');
  }

  const { tokenV, tokenGL } = await getTokens();
  const project  = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  // Monta contents com system prompt como primeiro turno do usuário
  const contents = [
    { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: '{"message": "Entendido! Estou pronto para ajudar."}' }] },
    ...history.map(msg => ({
      role:  msg.role === 'model' ? 'model' : 'user',
      parts: buildParts(msg),
    })),
  ];

  const body = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
  });

  const endpoints = [
    {
      hostname: `${location}-aiplatform.googleapis.com`,
      path: `/v1/projects/${project}/locations/${location}/publishers/google/models/${MODEL}:generateContent`,
      token: tokenV,
    },
    {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent`,
      token: tokenGL,
    },
  ];

  let lastError;
  for (const ep of endpoints) {
    try {
      const result = await httpPost(ep.hostname, ep.path, body, ep.token, project);
      const raw    = result.candidates[0].content.parts[0].text.trim();
      const clean  = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

      // Tenta parsear como JSON; se falhar, retorna como message pura
      try {
        const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);
        return {
          message: parsed.message || clean,
          action:  parsed.action  || null,
        };
      } catch {
        return { message: clean, action: null };
      }
    } catch (err) {
      console.warn(`[AI-CHAT] Endpoint ${ep.hostname} falhou: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError;
}

module.exports = { chat };
