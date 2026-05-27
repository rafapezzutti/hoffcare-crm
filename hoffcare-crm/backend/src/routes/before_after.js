const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/before_after');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ba_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens são permitidas'));
    cb(null, true);
  },
});

// GET /api/before-after?patient_id=X
router.get('/', auth, async (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id obrigatório' });
  try {
    const result = await pool.query(
      `SELECT * FROM patient_before_after WHERE patient_id=$1 AND clinic_id=$2
       ORDER BY photo_date DESC, created_at DESC`,
      [patient_id, req.user.clinic_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/before-after — upload de foto
router.post('/', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto obrigatória' });
  const { patient_id, photo_type, procedure_name, photo_date, notes } = req.body;
  if (!patient_id || !photo_type) return res.status(400).json({ error: 'patient_id e photo_type obrigatórios' });
  try {
    const result = await pool.query(
      `INSERT INTO patient_before_after (patient_id, clinic_id, procedure_name, photo_date, photo_type, filename, original_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [patient_id, req.user.clinic_id, procedure_name || null, photo_date || new Date().toISOString().slice(0,10),
       photo_type, req.file.filename, req.file.originalname, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/before-after/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT filename FROM patient_before_after WHERE id=$1 AND clinic_id=$2',
      [req.params.id, req.user.clinic_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Foto não encontrada' });
    const filePath = path.join(uploadDir, r.rows[0].filename);
    fs.unlink(filePath, () => {});
    await pool.query('DELETE FROM patient_before_after WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
