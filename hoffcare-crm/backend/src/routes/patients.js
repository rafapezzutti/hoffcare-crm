const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// List patients
router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const clinic_id = req.user.clinic_id;
    let query = 'SELECT id, name, cpf, birthdate, phone, email, created_at FROM patients';
    const params = [];
    const conditions = [];
    if (clinic_id) { conditions.push(`clinic_id = $${params.length+1}`); params.push(clinic_id); }
    if (search) {
      conditions.push(`(name ILIKE $${params.length+1} OR cpf ILIKE $${params.length+1})`);
      params.push(`%${search}%`);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get patient detail
router.get('/:id', auth, async (req, res) => {
  try {
    const clinic_id = req.user.clinic_id;
    const patient = await pool.query(
      'SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
      [req.params.id, clinic_id]
    );
    if (!patient.rows[0]) return res.status(404).json({ error: 'Paciente não encontrado' });

    const declaration = await pool.query(
      'SELECT * FROM health_declarations WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.id]
    );
    const attachments = await pool.query(
      'SELECT * FROM patient_attachments WHERE patient_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      ...patient.rows[0],
      health_declaration: declaration.rows[0] || null,
      attachments: attachments.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create patient
router.post('/', auth, async (req, res) => {
  const { name, cpf, birthdate, phone, email, health_declaration, batch_import } = req.body;
  // Em importação em lote (batch_import: true), birthdate é opcional
  if (!name || !cpf)
    return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
  if (!batch_import && !birthdate)
    return res.status(400).json({ error: 'Nome, CPF e data de nascimento são obrigatórios' });

  const clinic_id = req.user.clinic_id || req.body.clinic_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO patients (name, cpf, birthdate, phone, email, clinic_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, cpf, birthdate, phone, email, clinic_id]
    );
    const patient = result.rows[0];

    if (health_declaration) {
      const hd = health_declaration;
      await client.query(
        `INSERT INTO health_declarations (patient_id, has_diabetes, is_smoker, has_cardiac_history,
         has_surgeries, has_other_conditions, other_conditions_comment, comment, declaration_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [patient.id, hd.has_diabetes, hd.is_smoker, hd.has_cardiac_history,
         hd.has_surgeries, hd.has_other_conditions, hd.other_conditions_comment,
         hd.comment, hd.declaration_date || null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(patient);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado neste consultório' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update patient
router.put('/:id', auth, async (req, res) => {
  const { name, cpf, birthdate, phone, email, health_declaration } = req.body;
  const clinic_id = req.user.clinic_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE patients SET name=$1, cpf=$2, birthdate=$3, phone=$4, email=$5 WHERE id=$6 AND clinic_id=$7 RETURNING *',
      [name, cpf, birthdate, phone, email, req.params.id, clinic_id]
    );
    if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Paciente não encontrado' }); }

    if (health_declaration) {
      const hd = health_declaration;
      await client.query('DELETE FROM health_declarations WHERE patient_id = $1', [req.params.id]);
      await client.query(
        `INSERT INTO health_declarations (patient_id, has_diabetes, is_smoker, has_cardiac_history,
         has_surgeries, has_other_conditions, other_conditions_comment, comment, declaration_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [req.params.id, hd.has_diabetes, hd.is_smoker, hd.has_cardiac_history,
         hd.has_surgeries, hd.has_other_conditions, hd.other_conditions_comment,
         hd.comment, hd.declaration_date || null]
      );
    }
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Upload attachment
router.post('/:id/attachments', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });
  try {
    const result = await pool.query(
      'INSERT INTO patient_attachments (patient_id, filename, original_name, file_path) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.file.filename, req.file.originalname, req.file.path]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete patient
router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const check = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
      [req.params.id, clinic_id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Paciente não encontrado' });

    await pool.query('DELETE FROM patients WHERE id = $1 AND clinic_id = $2', [req.params.id, clinic_id]);
    res.json({ message: 'Paciente removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete attachment
router.delete('/:id/attachments/:attachId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM patient_attachments WHERE id = $1 AND patient_id = $2',
      [req.params.attachId, req.params.id]);
    res.json({ message: 'Arquivo removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
