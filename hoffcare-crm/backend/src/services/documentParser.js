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

// ── Pré-processamento de texto ────────────────────────────────────────────────

/**
 * Pré-processa o texto extraído:
 * 1. Normaliza CPFs formatados (000.000.000-00) → CPF:00000000000
 * 2. Extrai pares nome+CPF de forma estruturada quando possível
 * Isso evita que o Gemini tente interpretar formatação e se perca.
 */
function preprocessText(rawText) {
  const CPF_REGEX = /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/g;

  // Substitui CPF formatado por versão clara: [CPF:33489931807]
  const normalized = rawText.replace(CPF_REGEX, (_, a, b, c, d) => `[CPF:${a}${b}${c}${d}]`);

  // Tenta extrair pares NOME + CPF linha a linha para dar contexto estruturado
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const pairs = [];
  const seenCPFs = new Set();

  for (const line of lines) {
    const cpfMatch = line.match(/\[CPF:(\d{11})\]/g);
    if (!cpfMatch) continue;

    // Pega todos CPFs da linha
    for (const cpfTag of cpfMatch) {
      const cpf = cpfTag.replace('[CPF:', '').replace(']', '');
      if (seenCPFs.has(cpf)) continue;
      seenCPFs.add(cpf);

      // Remove o CPF do texto para obter o nome
      let namePart = line
        .replace(/\[CPF:\d{11}\]/g, '')
        .replace(/\d{1,3}[.,]\d{3}[.,]\d{2,3}/g, '') // remove valores monetários
        .replace(/N[°º]\s*\w+/gi, '')                 // remove N°NF
        .replace(/\(Menor\s+/gi, '| Menor: ')         // destaca menores
        .replace(/\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (namePart.length > 3) {
        pairs.push(`NOME: ${namePart} | CPF: ${cpf}`);
      }
    }
  }

  // Retorna versão estruturada se encontrou pares, senão o texto normalizado
  if (pairs.length > 0) {
    return `=== REGISTROS IDENTIFICADOS (${pairs.length}) ===\n` + pairs.join('\n') + '\n\n=== TEXTO COMPLETO ===\n' + normalized;
  }
  return normalized;
}

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

  return preprocessText(raw);
}

module.exports = { extractText, detectType };
