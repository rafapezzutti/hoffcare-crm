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

  patient_batch: `Você é um assistente especializado em extração de dados de fichas médicas em português brasileiro.
Analise esta imagem que pode conter dados de UM OU MAIS pacientes (lista, tabela, fichas múltiplas, etc.).
Extraia TODOS os pacientes visíveis na imagem.
Retorne APENAS um array JSON válido, sem markdown, sem blocos de código, sem explicações.
Cada elemento do array representa um paciente. Use null para campos não encontrados ou ilegíveis.
Se houver apenas um paciente, retorne um array com um elemento.

Estrutura obrigatória:
[
  {
    "name": "nome completo",
    "cpf": "somente dígitos, sem pontos ou traços",
    "birthdate": "YYYY-MM-DD",
    "phone": "somente dígitos",
    "email": "endereço de e-mail",
    "address": "endereço completo",
    "gender": "M ou F",
    "profession": "profissão",
    "notes": "observações"
  }
]`,

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

      // patient_batch retorna array — tenta match de array primeiro
      if (documentType === 'patient_batch') {
        const arrMatch = clean.match(/\[[\s\S]*\]/);
        if (!arrMatch) throw new Error('A IA não retornou um array JSON válido. Tente com uma imagem mais nítida.');
        return JSON.parse(arrMatch[0]);
      }

      const match = clean.match(/\{[\s\S]*\}/);
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

// ── Extração a partir de texto (documentos: xlsx, csv, docx, txt, pdf) ────────

const PROMPT_TEXT_BATCH = `Você é um assistente especializado em extração de nomes e CPFs de documentos brasileiros.
Analise o texto abaixo — pode ser uma lista de pacientes, planilha de notas fiscais, cadastro, tabela, relatório ou qualquer documento que contenha nomes e CPFs de pessoas.
Sua tarefa é identificar TODAS as pessoas (físicas) presentes no texto, independentemente do formato do documento.

REGRAS IMPORTANTES:
- Extraia TODA pessoa que tenha nome completo E/OU CPF identificável no texto
- CPF pode estar formatado (000.000.000-00) ou só números — converta sempre para somente dígitos
- Se houver texto como "Menor X" ou "(Menor X)" junto a um nome, é o nome do paciente real — use esse nome
- Se o mesmo CPF aparece várias vezes, inclua apenas UMA vez (remova duplicatas pelo CPF)
- Ignore totalizadores, cabeçalhos, meses, valores monetários — foque em NOMES e CPFs
- Use null para campos não encontrados. Não invente dados.

Retorne APENAS um array JSON válido, sem markdown, sem blocos de código, sem texto adicional.
Se não encontrar nenhuma pessoa, retorne: []

Estrutura obrigatória:
[
  {
    "name": "nome completo da pessoa",
    "cpf": "somente 11 dígitos sem pontos ou traços",
    "birthdate": "YYYY-MM-DD ou null",
    "phone": "somente dígitos ou null",
    "email": "email ou null",
    "address": "endereço completo ou null",
    "gender": "M ou F ou null",
    "profession": "profissão ou null",
    "notes": "observações relevantes ou null"
  }
]

Texto para analisar:
`;

async function extractFromText(textContent) {
  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_CREDENTIALS_JSON não configurado.');
  }

  const authGL = new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
    scopes: ['https://www.googleapis.com/auth/generative-language'],
  });
  const tokenGL = await authGL.getAccessToken();

  // Limita o texto a 30.000 chars para não exceder tokens
  const truncated = textContent.length > 30000
    ? textContent.slice(0, 30000) + '\n[... texto truncado ...]'
    : textContent;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT_TEXT_BATCH + truncated }] }],
    generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
  });

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const result  = await httpPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/${MODEL}:generateContent`,
    body, tokenGL, project
  );

  const text  = result.candidates[0].content.parts[0].text.trim();
  const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  // Tenta match de array JSON
  const match = clean.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn('[OCR-DOC] Resposta da IA (não era array):', clean.slice(0, 500));
    // Tenta objeto único e envolve em array
    const objMatch = clean.match(/\{[\s\S]*\}/);
    if (objMatch) return [JSON.parse(objMatch[0])];
    throw new Error('A IA não encontrou pessoas com nome/CPF neste documento. Verifique se o arquivo contém dados de pacientes.');
  }
  return JSON.parse(match[0]);
}

module.exports = { extractFromImage, extractFromText };
