const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/evolution');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `evolution_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas.'));
  },
});

// Garante a tabela (fallback caso a migration ainda não rodou)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinical_evolutions (
      id                SERIAL PRIMARY KEY,
      clinic_id         INTEGER NOT NULL,
      patient_id        INTEGER NOT NULL,
      professional_name VARCHAR(200),
      note              TEXT NOT NULL,
      images            JSONB NOT NULL DEFAULT '[]',
      evolution_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensureTable().catch(console.error);

// ── GET /api/evolution?patient_id=X ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clinical_evolutions
       WHERE patient_id=$1 AND clinic_id=$2
       ORDER BY evolution_date DESC, created_at DESC`,
      [patient_id, req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/evolution — cria com imagens opcionais ────────────────────────
router.post('/', auth, upload.array('images', 8), async (req, res) => {
  const { patient_id, note, evolution_date, professional_name } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  if (!note?.trim()) return res.status(400).json({ error: 'Anotação obrigatória' });

  const images = (req.files || []).map(f => ({
    filename:      f.filename,
    original_name: f.originalname,
  }));

  try {
    const { rows } = await pool.query(
      `INSERT INTO clinical_evolutions
         (clinic_id, patient_id, professional_name, note, images, evolution_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        req.user.clinic_id,
        patient_id,
        professional_name?.trim() || null,
        note.trim(),
        JSON.stringify(images),
        evolution_date || new Date().toISOString().slice(0, 10),
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/evolution/:id ───────────────────────────────────────────────────
router.put('/:id', auth, upload.array('images', 8), async (req, res) => {
  const { note, evolution_date, professional_name, keep_images } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Anotação obrigatória' });

  try {
    const r = await pool.query(
      'SELECT images FROM clinical_evolutions WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });

    // Mantém imagens anteriores que não foram removidas + adiciona novas
    const existing = Array.isArray(r.rows[0].images) ? r.rows[0].images : [];
    const kept     = keep_images
      ? (Array.isArray(keep_images) ? keep_images : [keep_images]).map(f => existing.find(i => i.filename === f)).filter(Boolean)
      : existing;
    const newImgs  = (req.files || []).map(f => ({ filename: f.filename, original_name: f.originalname }));

    // Remove do disco imagens que foram descartadas
    const keptNames = kept.map(i => i.filename);
    existing.filter(i => !keptNames.includes(i.filename)).forEach(i => {
      const fp = path.join(uploadDir, i.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });

    const images = [...kept, ...newImgs];

    const { rows } = await pool.query(
      `UPDATE clinical_evolutions
       SET note=$1, evolution_date=$2, professional_name=$3, images=$4, updated_at=NOW()
       WHERE id=$5 AND clinic_id=$6 RETURNING *`,
      [note.trim(), evolution_date, professional_name?.trim() || null, JSON.stringify(images), req.params.id, req.user.clinic_id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/evolution/:id ────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT images FROM clinical_evolutions WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });

    // Remove arquivos do disco
    const imgs = Array.isArray(r.rows[0].images) ? r.rows[0].images : [];
    imgs.forEach(i => {
      const fp = path.join(uploadDir, i.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });

    await pool.query('DELETE FROM clinical_evolutions WHERE id=$1 AND clinic_id=$2', [req.params.id, req.user.clinic_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
