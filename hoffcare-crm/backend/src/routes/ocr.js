const express  = require('express');
const multer   = require('multer');
const { auth } = require('../middleware/auth');
const { extractFromImage, extractFromText } = require('../services/vertexai');
const { extractText, detectType }          = require('../services/documentParser');

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

    const data = await extractFromImage(imageBase64, mimeType, type);

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

    // 1. Extrai texto do arquivo
    const text = await extractText(buffer, mimetype, originalname);
    console.log(`[OCR-DOC] Texto extraído: ${text.length} chars`);

    // 2. Manda para Gemini extrair pacientes
    const patients = await extractFromText(text);
    console.log(`[OCR-DOC] Pacientes encontrados: ${patients.length}`);

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
