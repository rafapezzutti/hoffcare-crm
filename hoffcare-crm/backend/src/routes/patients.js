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

// ── GET /api/patients/:id/timeline — todos os eventos do paciente ────────────
router.get('/:id/timeline', auth, async (req, res) => {
  const { id } = req.params;
  const clinic_id = req.user.clinic_id;
  try {
    const events = [];

    // Prontuários
    const records = await pool.query(
      `SELECT id, consultation_date as date, 'record' as type,
              professional_name, total_value, specialty
       FROM patient_records WHERE patient_id=$1 AND clinic_id=$2`,
      [id, clinic_id]
    );
    records.rows.forEach(r => events.push({
      type:     'record',
      date:     r.date,
      title:    `Consulta ${r.specialty === 'odontologico' ? 'Odontológica' : 'Médica'}`,
      subtitle: r.professional_name || '',
      detail:   r.total_value > 0 ? `R$ ${Number(r.total_value).toFixed(2)}` : '',
      icon:     'fa-file-medical',
      color:    '#4DB8E8',
      link:     `/records/${r.id}/view`,
    }));

    // Anamneses respondidas
    const anamneses = await pool.query(
      `SELECT id, completed_at as date, custom_questions
       FROM patient_anamnesis WHERE patient_id=$1 AND clinic_id=$2 AND status='completed'`,
      [id, clinic_id]
    );
    anamneses.rows.forEach(a => {
      const qs = Array.isArray(a.custom_questions) ? a.custom_questions : (() => { try { return JSON.parse(a.custom_questions); } catch { return []; } })();
      events.push({
        type:    'anamnese',
        date:    a.date,
        title:   'Anamnese respondida',
        subtitle:`${qs.length} pergunta${qs.length !== 1 ? 's' : ''}`,
        icon:    'fa-clipboard-check',
        color:   '#34d399',
        link:    null,
      });
    });

    // Evoluções clínicas
    const evolutions = await pool.query(
      `SELECT id, evolution_date as date, professional_name, note,
              jsonb_array_length(images) as img_count
       FROM clinical_evolutions WHERE patient_id=$1 AND clinic_id=$2`,
      [id, clinic_id]
    ).catch(() => ({ rows: [] }));
    evolutions.rows.forEach(e => events.push({
      type:    'evolution',
      date:    e.date,
      title:   'Evolução clínica registrada',
      subtitle: e.professional_name || '',
      detail:  e.note?.slice(0, 80) + (e.note?.length > 80 ? '…' : ''),
      icon:    'fa-notes-medical',
      color:   '#f59e0b',
      link:    null,
    }));

    // Histórico de procedimentos do odontograma
    const toothHistory = await pool.query(
      `SELECT id, procedure_date as date, tooth_number, procedure_name, professional_name
       FROM odontogram_tooth_history WHERE patient_id=$1 AND clinic_id=$2`,
      [id, clinic_id]
    ).catch(() => ({ rows: [] }));
    toothHistory.rows.forEach(h => events.push({
      type:    'tooth_procedure',
      date:    h.date,
      title:   `Dente ${h.tooth_number} — ${h.procedure_name}`,
      subtitle: h.professional_name || '',
      icon:    'fa-tooth',
      color:   '#8b5cf6',
      link:    null,
    }));

    // Orçamentos
    const budgets = await pool.query(
      `SELECT id, created_at as date, number, status, total
       FROM budgets WHERE patient_id=$1 AND clinic_id=$2`,
      [id, clinic_id]
    ).catch(() => ({ rows: [] }));
    budgets.rows.forEach(b => events.push({
      type:    'budget',
      date:    b.date,
      title:   `Orçamento ${b.number ? '#' + b.number : ''} — ${b.status}`,
      subtitle:'',
      detail:  `R$ ${Number(b.total).toFixed(2)}`,
      icon:    'fa-file-invoice',
      color:   '#E8841A',
      link:    `/budgets/${b.id}/edit`,
    }));

    // Ordena por data desc
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/patients/:id/financial — histórico financeiro ───────────────────
router.get('/:id/financial', auth, async (req, res) => {
  const { id } = req.params;
  const clinic_id = req.user.clinic_id;
  try {
    const items = [];

    // Prontuários com valor
    const records = await pool.query(
      `SELECT consultation_date as date, professional_name,
              total_value as value, specialty, 'record' as type
       FROM patient_records WHERE patient_id=$1 AND clinic_id=$2 AND total_value > 0`,
      [id, clinic_id]
    );
    records.rows.forEach(r => items.push({
      date:        r.date,
      description: `Consulta ${r.specialty === 'odontologico' ? 'Odontológica' : 'Médica'}`,
      professional: r.professional_name || '',
      value:       Number(r.value),
      type:        'record',
      status:      'pago',
    }));

    // Procedimentos do plano de tratamento pagos/parciais
    const odontoPayments = await pool.query(
      `SELECT updated_at as date, tooth_number, procedure_name, procedure_value,
              payment_status, amount_paid
       FROM odontogram_teeth
       WHERE patient_id=$1 AND clinic_id=$2 AND procedure_name IS NOT NULL
         AND payment_status IN ('pago','parcial')`,
      [id, clinic_id]
    ).catch(() => ({ rows: [] }));
    odontoPayments.rows.forEach(p => {
      const value = p.payment_status === 'pago'
        ? Number(p.procedure_value)
        : Number(p.amount_paid);
      if (value > 0) items.push({
        date:        p.date,
        description: `Dente ${p.tooth_number} — ${p.procedure_name}`,
        professional:'',
        value,
        type:        'odontogram',
        status:      p.payment_status,
      });
    });

    // Orçamentos aceitos
    const budgets = await pool.query(
      `SELECT created_at as date, number, total as value, 'budget' as type
       FROM budgets WHERE patient_id=$1 AND clinic_id=$2 AND status='aceito'`,
      [id, clinic_id]
    ).catch(() => ({ rows: [] }));
    budgets.rows.forEach(b => items.push({
      date:        b.date,
      description: `Orçamento aceito${b.number ? ' #' + b.number : ''}`,
      professional:'',
      value:       Number(b.value),
      type:        'budget',
      status:      'pago',
    }));

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = items.reduce((s, i) => s + i.value, 0);
    res.json({ items, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
