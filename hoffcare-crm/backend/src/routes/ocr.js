const express  = require('express');
const multer   = require('multer');
const { auth } = require('../middleware/auth');
const { extractFromImage, extractFromText, extractRawTextFromImage, extractFromTextWithType } = require('../services/vertexai');
const { extractText, detectType, extractPatientsFromDocument } = require('../services/documentParser');

// Normaliza CPF em qualquer dado retornado pela IA (objeto ou array)
function normalizeCPF(data) {
  if (Array.isArray(data)) return data.map(normalizeCPF);
  if (data && typeof data === 'object' && data.cpf) {
    return { ...data, cpf: String(data.cpf).replace(/\D/g, '') };
  }
  return data;
}

const router = express.Router();

// Upload de imagens
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato não suportado. Use JPG, PNG ou WEBP.'));
  },
});

// Upload de documentos (xlsx, csv, docx, txt, pdf)
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const type = detectType(file.mimetype, file.originalname);
    if (type) cb(null, true);
    else cb(new Error(`Formato não suportado. Use: xlsx, xls, csv, docx, doc, txt ou pdf.`));
  },
});

const VALID_TYPES = ['patient', 'patient_batch', 'anamnesis', 'financial', 'evolution'];

/**
 * POST /api/ocr/extract
 * Body: multipart/form-data
 *   image (file)  — foto ou scan do documento
 *   type  (text)  — patient | anamnesis | financial | evolution
 *
 * Response: { success: true, type, data: { ...campos extraídos } }
 */
router.post('/extract', auth, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const { type = 'patient' } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Tipo inválido. Use um de: ${VALID_TYPES.join(', ')}.`,
      });
    }

    // Verifica se o serviço está configurado
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      return res.status(503).json({
        error: 'Serviço de OCR não configurado. Contate o administrador.',
      });
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType    = req.file.mimetype;

    console.log(`[OCR] Processando documento tipo "${type}" (${(req.file.size / 1024).toFixed(0)} KB)`);

    let raw;
    if (type === 'patient_batch') {
      // Para lote de imagens, sempre usa pipeline híbrido: OCR → texto → extractFromText.
      // Garante resultado completo, evitando limitação de tokens da extração visual.
      console.log('[OCR] Patient batch: pipeline OCR→texto');
      const rawText = await extractRawTextFromImage(imageBase64, mimeType);
      console.log(`[OCR] Texto extraído da imagem (${rawText.length} chars)`);
      raw = await extractFromText(rawText);
      console.log(`[OCR] Pipeline retornou ${Array.isArray(raw) ? raw.length : 1} registro(s)`);
    } else {
      // Para tipos single-document: tenta extração visual; se falhar, cai no pipeline OCR→texto.
      try {
        raw = await extractFromImage(imageBase64, mimeType, type);
        console.log(`[OCR] Extração visual OK para tipo "${type}"`);
      } catch (visErr) {
        console.warn(`[OCR] Extração visual falhou para tipo "${type}" (${visErr.message}). Ativando fallback OCR→texto...`);
        const rawText = await extractRawTextFromImage(imageBase64, mimeType);
        console.log(`[OCR] Texto extraído (${rawText.length} chars), processando como tipo "${type}"...`);
        raw = await extractFromTextWithType(rawText, type);
        console.log(`[OCR] Fallback OK para tipo "${type}"`);
      }
    }

    const data = normalizeCPF(raw);

    return res.json({ success: true, type, data });

  } catch (err) {
    console.error('[OCR] Erro:', err.message);

    if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns minutos.' });
    }
    if (err.message.includes('JSON')) {
      return res.status(422).json({ error: 'Não foi possível extrair dados. Tente com uma imagem mais nítida.' });
    }
    if (err.message.includes('PERMISSION_DENIED') || err.message.includes('credentials')) {
      return res.status(503).json({ error: 'Credenciais do Google Cloud inválidas. Contate o administrador.' });
    }

    return res.status(500).json({ error: 'Erro ao processar imagem: ' + err.message });
  }
});

/**
 * POST /api/ocr/extract-document
 * Body: multipart/form-data
 *   file (file) — xlsx, xls, csv, docx, doc, txt, pdf
 *
 * Response: { success: true, count, data: [ ...pacientes ] }
 */
router.post('/extract-document', auth, uploadDocument.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      return res.status(503).json({ error: 'Serviço OCR não configurado.' });
    }

    const { buffer, mimetype, originalname, size } = req.file;
    console.log(`[OCR-DOC] Processando "${originalname}" (${(size / 1024).toFixed(0)} KB)`);

    // 1. Extrai texto do arquivo + tenta extração direta por regex
    const { direct, raw: rawText } = await extractPatientsFromDocument(buffer, mimetype, originalname);
    console.log(`[OCR-DOC] Extração direta: ${direct.length} pacientes`);

    let patients;

    if (direct.length > 0) {
      // Documento estruturado — usa extração direta (sem IA, 100% preciso)
      patients = direct.map(p => ({ ...p, birthdate: null, phone: null, email: null, address: null, gender: null, profession: null, notes: null }));
      console.log(`[OCR-DOC] Usando extração direta: ${patients.length} pacientes`);
    } else {
      // Documento não estruturado — envia para a IA
      console.log(`[OCR-DOC] Sem extração direta, enviando para IA...`);
      const text = await extractText(buffer, mimetype, originalname);
      const raw  = await extractFromText(text);
      patients   = normalizeCPF(raw);
      console.log(`[OCR-DOC] IA retornou: ${patients.length} pacientes`);
    }

    return res.json({ success: true, count: patients.length, data: patients });

  } catch (err) {
    console.error('[OCR-DOC] Erro:', err.message);
    if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Limite de requisições atingido. Aguarde alguns minutos.' });
    }
    return res.status(500).json({ error: 'Erro ao processar arquivo: ' + err.message });
  }
});

module.exports = router;
