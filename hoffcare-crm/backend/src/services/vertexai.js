/**
 * Serviço OCR via Gemini API REST
 * Usa google-auth-library para autenticar com Service Account
 * Endpoint: generativelanguage.googleapis.com (Generative Language API)
 */

const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const MODEL = process.env.VERTEX_MODEL || 'gemini-1.5-flash';

// ── Prompts por tipo de documento ─────────────────────────────────────────────

const PROMPTS = {
  patient: `Você é um assistente especializado em extração de dados de fichas médicas em português brasileiro.
Analise esta imagem de um documento físico e extraia os dados pessoais do paciente.
Retorne APENAS um objeto JSON válido, sem markdown, sem blocos de código, sem explicações.
Use null para campos não encontrados ou ilegíveis.

Estrutura obrigatória:
{
  "name": "nome completo",
  "cpf": "somente dígitos, sem pontos ou traços",
  "birthdate": "YYYY-MM-DD",
  "phone": "somente dígitos",
  "email": "endereço de e-mail",
  "address": "endereço completo",
  "gender": "M ou F",
  "profession": "profissão",
  "emergency_contact": "nome e telefone do contato de emergência",
  "notes": "observações gerais"
}`,

  anamnesis: `Você é um assistente especializado em extração de dados de anamnese médica em português brasileiro.
Analise esta imagem de uma ficha de anamnese e extraia todas as informações clínicas visíveis.
Retorne APENAS um objeto JSON válido, sem markdown, sem blocos de código, sem explicações.
Use null para campos não encontrados.

Estrutura obrigatória:
{
  "chief_complaint": "queixa principal",
  "medical_history": "histórico médico relevante",
  "allergies": "alergias a medicamentos, alimentos ou outros",
  "medications": "medicamentos em uso contínuo",
  "surgeries": "cirurgias ou internações anteriores",
  "family_history": "histórico familiar de doenças",
  "habits": "tabagismo, etilismo, atividade física",
  "answers": [{ "question": "pergunta da ficha", "answer": "resposta registrada" }],
  "notes": "observações adicionais"
}`,

  financial: `Você é um assistente especializado em extração de dados financeiros de fichas médicas em português brasileiro.
Analise esta imagem e extraia todos os dados financeiros visíveis.
Retorne APENAS um objeto JSON válido, sem markdown, sem blocos de código.
Valores monetários devem ser números (ex: 150.00).

Estrutura obrigatória:
{
  "date": "YYYY-MM-DD",
  "patient_name": "nome do paciente",
  "professional_name": "nome do profissional",
  "procedures": [{ "name": "nome", "quantity": 1, "unit_value": 0.00, "total_value": 0.00 }],
  "subtotal": 0.00,
  "discount": 0.00,
  "total": 0.00,
  "payment_method": "forma de pagamento",
  "notes": "observações"
}`,

  evolution: `Você é um assistente especializado em extração de evolução clínica em português brasileiro.
Analise esta imagem de um prontuário e extraia as informações no formato SOAP.
Retorne APENAS um objeto JSON válido, sem markdown, sem blocos de código.

Estrutura obrigatória:
{
  "date": "YYYY-MM-DD",
  "professional": "nome do profissional",
  "subjective": "S — queixa e relato do paciente",
  "objective": "O — exame físico e sinais vitais",
  "assessment": "A — diagnóstico ou avaliação",
  "plan": "P — conduta e prescrição",
  "procedures_performed": "procedimentos realizados",
  "next_appointment": "próxima consulta",
  "notes": "observações"
}`
};

// ── Chamada direta à API REST ─────────────────────────────────────────────────

async function extractFromImage(imageBase64, mimeType, documentType) {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_CREDENTIALS_JSON não configurado.');
  }

  // Obtém access token via Service Account
  // Tenta cloud-platform (Vertex AI) e generative-language (Generative Language API)
  const authV  = new GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const authGL = new GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes: ['https://www.googleapis.com/auth/generative-language'] });
  const tokenV  = await authV.getAccessToken();
  const tokenGL = await authGL.getAccessToken();
  const accessToken = tokenV; // usado no fallback abaixo

  const prompt = PROMPTS[documentType] || PROMPTS.patient;

  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.1 }
  });

  const project  = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  // Tenta Vertex AI primeiro, fallback para Generative Language API
  const endpoints = [
    {
      hostname: `${location}-aiplatform.googleapis.com`,
      path: `/v1/projects/${project}/locations/${location}/publishers/google/models/${MODEL}:generateContent`,
    },
    {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${MODEL}:generateContent`,
    }
  ];

  const tokens = [tokenV, tokenGL];
  let lastError;
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const token    = tokens[i] || tokenGL;
    try {
      const result = await httpPost(endpoint.hostname, endpoint.path, body, token, project);
      const text   = result.candidates[0].content.parts[0].text.trim();
      const clean  = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      const match  = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('A IA não retornou um JSON válido. Tente com uma imagem mais nítida.');
      return JSON.parse(match[0]);
    } catch (err) {
      console.warn(`[OCR] Endpoint ${endpoint.hostname} falhou: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

function httpPost(hostname, path, body, accessToken, project) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
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
          reject(new Error(`Resposta inválida: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { extractFromImage };
