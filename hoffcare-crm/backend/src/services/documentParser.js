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

/**
 * Extrai texto de um buffer de arquivo
 * @param {Buffer} buffer   Conteúdo do arquivo
 * @param {string} mimetype MIME type
 * @param {string} filename Nome original do arquivo
 * @returns {Promise<string>} Texto extraído
 */
async function extractText(buffer, mimetype, filename) {
  const type = detectType(mimetype, filename);
  if (!type) throw new Error(`Formato não suportado: ${mimetype || filename}`);

  switch (type) {
    case 'xlsx': return extractXlsx(buffer);
    case 'csv':  return extractCsv(buffer);
    case 'docx': return extractDocx(buffer);
    case 'txt':  return buffer.toString('utf-8');
    case 'pdf':  return extractPdf(buffer);
    default: throw new Error(`Tipo não implementado: ${type}`);
  }
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

module.exports = { extractText, detectType };
