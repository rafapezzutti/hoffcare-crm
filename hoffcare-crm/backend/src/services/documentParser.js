/**
 * documentParser.js
 * Extrai texto estruturado de arquivos Word, Excel, CSV, TXT e PDF.
 * Retorna uma string de texto que será enviada ao Gemini para extração de pacientes.
 */

const path = require('path');

/**
 * Detecta o tipo de arquivo pelo mimetype ou extensão
 */
function detectType(mimetype, originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') return 'xlsx';
  if (mimetype === 'application/vnd.ms-excel' || ext === '.xls') return 'xlsx';
  if (mimetype === 'text/csv' || ext === '.csv') return 'csv';
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') return 'docx';
  if (mimetype === 'application/msword' || ext === '.doc') return 'docx';
  if (mimetype === 'text/plain' || ext === '.txt') return 'txt';
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  return null;
}

// ── Excel (.xlsx / .xls) ──────────────────────────────────────────────────────
function extractXlsx(buffer) {
  const XLSX = require('xlsx');
  const wb   = XLSX.read(buffer, { type: 'buffer' });

  let result = '';
  for (const sheetName of wb.SheetNames) {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length === 0) continue;
    result += `=== Planilha: ${sheetName} ===\n`;

    // Detecta cabeçalhos (primeira linha não vazia)
    const header = rows[0].map(h => String(h).trim());
    result += header.join(' | ') + '\n';
    result += '---\n';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every(cell => String(cell).trim() === '')) continue; // linha vazia
      result += row.map(cell => String(cell).trim()).join(' | ') + '\n';
    }
    result += '\n';
  }

  if (!result.trim()) throw new Error('Planilha vazia ou sem dados legíveis.');
  return result;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function extractCsv(buffer) {
  const text = buffer.toString('utf-8');
  if (!text.trim()) throw new Error('Arquivo CSV vazio.');
  return text;
}

// ── Word (.docx) ──────────────────────────────────────────────────────────────
async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const result  = await mammoth.extractRawText({ buffer });
  if (!result.value.trim()) throw new Error('Documento Word sem texto legível.');
  return result.value;
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data     = await pdfParse(buffer);
  if (!data.text.trim()) throw new Error('PDF sem texto extraível. Use uma imagem para PDFs escaneados.');
  return data.text;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CPF_FORMATTED = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const CPF_DIGITS    = /^\d{11}$/;

// Verifica se uma string parece um nome de pessoa (tem letras, não é só número/data)
function looksLikeName(str) {
  if (!str || str.length < 4) return false;
  if (/^\d/.test(str)) return false;                          // começa com número
  if (/^\d{1,2}\/\d{1,2}/.test(str)) return false;           // data
  if (/^(total|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|nome|cpf|valor|n[°º])/i.test(str)) return false;
  return /[A-Za-zÀ-ú]{3,}/.test(str);                        // tem pelo menos 3 letras seguidas
}

// Limpa o nome: remove "(Menor X)" mas mantém o nome principal, remove valores e nf
function extractPrimaryName(str) {
  // Se tem "(Menor X)" sem CPF junto, o nome principal é o que está antes
  return str
    .replace(/\(menor\s+[^)]+\)/gi, '')   // remove "(menor ...)" completo
    .replace(/\bmenor\b.*/gi, '')          // remove "menor ..." até o fim
    .replace(/\d{1,3}[.,]\d{3}[.,\d]*/g, '') // remove valores monetários
    .replace(/N[°º]\s*\d+/gi, '')          // remove N°NF
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Extrai CPFs inline dentro de texto (ex: "...Barros 592.778.658-26)")
function extractInlineCPFs(str) {
  const found = [];
  const matches = str.matchAll(/(\d{3}\.\d{3}\.\d{3}-\d{2})/g);
  for (const m of matches) found.push(m[1].replace(/\D/g, ''));
  return found;
}

// ── Extração direta por regex (sem IA) ───────────────────────────────────────

/**
 * Extrai pares nome+CPF diretamente do texto usando regex.
 * Funciona para documentos onde nome e CPF estão em linhas adjacentes
 * ou na mesma linha.
 * Retorna array de { name, cpf } únicos (deduplicados por CPF).
 */
function extractPatientsDirectly(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());
  const patients = new Map(); // cpf → { name, cpf }

  const addPatient = (name, cpf) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return;
    if (patients.has(cleanCpf)) return; // deduplica
    const cleanName = extractPrimaryName(name);
    if (cleanName.length < 4) return;
    patients.set(cleanCpf, { name: cleanName, cpf: cleanCpf });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. CPF formatado NA MESMA linha que o nome
    const inlineCPFs = [...line.matchAll(/\d{3}\.\d{3}\.\d{3}-\d{2}/g)];
    if (inlineCPFs.length > 0) {
      // Remove todos os CPFs da linha para obter o nome
      const namePart = line.replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '').trim();

      if (looksLikeName(namePart)) {
        for (const m of inlineCPFs) addPatient(namePart, m[0]);
      } else {
        // CPF inline mas sem nome na mesma linha → busca nome na linha anterior
        for (const m of inlineCPFs) {
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            if (looksLikeName(lines[j])) { addPatient(lines[j], m[0]); break; }
          }
        }
      }

      // Também extrai CPFs inline dentro de texto "Menor X CPF"
      const inlineMenorCPFs = extractInlineCPFs(line);
      for (const cpf of inlineMenorCPFs) {
        if (!patients.has(cpf)) {
          // Tenta extrair o nome do Menor do texto
          const menorMatch = line.match(/\bmenor\s+([A-Za-zÀ-ú\s]+?)(?:\s+\d{3}\.\d{3}|\s*[,)]|$)/i);
          if (menorMatch) addPatient(menorMatch[1].trim(), cpf);
        }
      }
      continue;
    }

    // 2. Linha é apenas um CPF formatado → nome está na linha anterior
    const cpfOnly = line.match(/^(\d{3}\.\d{3}\.\d{3}-\d{2})\s*$/);
    if (cpfOnly) {
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        if (looksLikeName(lines[j])) {
          addPatient(lines[j], cpfOnly[1]);
          break;
        }
      }
    }
  }

  return [...patients.values()];
}

// ── Pré-processamento: converte para texto estruturado para a IA ──────────────

function buildStructuredText(patients, rawText) {
  if (patients.length === 0) {
    // Fallback: normaliza CPFs e manda texto bruto para a IA
    return rawText.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g, (_, a, b, c, d) => `CPF:${a}${b}${c}${d}`);
  }
  // Entrega lista estruturada para a IA refinar (datas, telefones, etc.)
  const lines = patients.map((p, i) =>
    `${i + 1}. NOME: ${p.name} | CPF: ${p.cpf}`
  );
  return `=== ${patients.length} REGISTROS PRÉ-EXTRAÍDOS ===\n` + lines.join('\n');
}

// ── API principal ─────────────────────────────────────────────────────────────

async function extractText(buffer, mimetype, filename) {
  const type = detectType(mimetype, filename);
  if (!type) throw new Error(`Formato não suportado: ${mimetype || filename}`);

  let raw;
  switch (type) {
    case 'xlsx': raw = extractXlsx(buffer); break;
    case 'csv':  raw = extractCsv(buffer); break;
    case 'docx': raw = await extractDocx(buffer); break;
    case 'txt':  raw = buffer.toString('utf-8'); break;
    case 'pdf':  raw = await extractPdf(buffer); break;
    default: throw new Error(`Tipo não implementado: ${type}`);
  }

  // Tenta extração direta antes de chamar a IA
  const direct = extractPatientsDirectly(raw);
  console.log(`[DOC-PARSER] Extração direta: ${direct.length} pacientes encontrados`);
  return buildStructuredText(direct, raw);
}

/**
 * Retorna os pacientes extraídos diretamente (sem precisar da IA)
 * quando o documento é estruturado o suficiente.
 */
async function extractPatientsFromDocument(buffer, mimetype, filename) {
  const type = detectType(mimetype, filename);
  if (!type) throw new Error(`Formato não suportado: ${mimetype || filename}`);

  let raw;
  switch (type) {
    case 'xlsx': raw = extractXlsx(buffer); break;
    case 'csv':  raw = extractCsv(buffer); break;
    case 'docx': raw = await extractDocx(buffer); break;
    case 'txt':  raw = buffer.toString('utf-8'); break;
    case 'pdf':  raw = await extractPdf(buffer); break;
    default: throw new Error(`Tipo não implementado: ${type}`);
  }

  return { direct: extractPatientsDirectly(raw), raw };
}

module.exports = { extractText, detectType, extractPatientsFromDocument };
