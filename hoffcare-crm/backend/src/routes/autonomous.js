const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// Lista todos os autônomos
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id as clinic_id,
        c.name as clinic_name,
        c.phone as clinic_phone,
        pr.id as professional_id,
        pr.type, pr.name, pr.cpf, pr.crm_cro,
        pr.birthdate, pr.email, pr.phone,
        u.id as user_id, u.email as login_email
      FROM clinics c
      JOIN professionals pr ON pr.clinic_id = c.id
      JOIN users u ON u.clinic_id = c.id
      WHERE c.is_autonomous = true
      ORDER BY pr.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria autônomo: clínica + usuário + profissional em uma transação
router.post('/', auth, adminOnly, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone, password } = req.body;

  if (!type || !name || !cpf || !crm_cro || !email || !password)
    return res.status(400).json({ error: 'Tipo, nome, CPF, CRM/CRO, e-mail e senha são obrigatórios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Cria a mini-clínica
    const clinicRes = await client.query(
      `INSERT INTO clinics (name, phone, email, is_autonomous)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [name, phone || null, email]
    );
    const clinic = clinicRes.rows[0];

    // 2. Cria o usuário de login
    const hashed = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password, role, clinic_id)
       VALUES ($1, $2, $3, 'user', $4) RETURNING id`,
      [name, email, hashed, clinic.id]
    );

    // 3. Cria o profissional vinculado à mini-clínica
    const profRes = await client.query(
      `INSERT INTO professionals (type, name, cpf, crm_cro, birthdate, email, phone, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [type, name, cpf, crm_cro, birthdate || null, email, phone || null, clinic.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      clinic_id: clinic.id,
      user_id: userRes.rows[0].id,
      professional: profRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      if (err.constraint?.includes('email')) return res.status(400).json({ error: 'E-mail já cadastrado' });
      if (err.constraint?.includes('cpf')) return res.status(400).json({ error: 'CPF já cadastrado' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Atualiza dados do autônomo
router.put('/:clinicId', auth, adminOnly, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone, password } = req.body;
  const { clinicId } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verifica se é autônomo
    const check = await client.query(
      'SELECT id FROM clinics WHERE id = $1 AND is_autonomous = true',
      [clinicId]
    );
    if (!check.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Autônomo não encontrado' });
    }

    // Atualiza clínica
    await client.query(
      `UPDATE clinics SET name=$1, phone=$2, email=$3 WHERE id=$4`,
      [name, phone || null, email, clinicId]
    );

    // Atualiza profissional
    await client.query(
      `UPDATE professionals SET type=$1, name=$2, cpf=$3, crm_cro=$4, birthdate=$5, email=$6, phone=$7
       WHERE clinic_id=$8`,
      [type, name, cpf, crm_cro, birthdate || null, email, phone || null, clinicId]
    );

    // Atualiza usuário
    if (password && password.length >= 6) {
      const hashed = await bcrypt.hash(password, 10);
      await client.query(
        `UPDATE users SET name=$1, email=$2, password=$3 WHERE clinic_id=$4`,
        [name, email, hashed, clinicId]
      );
    } else {
      await client.query(
        `UPDATE users SET name=$1, email=$2 WHERE clinic_id=$3`,
        [name, email, clinicId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Autônomo atualizado com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      if (err.constraint?.includes('email')) return res.status(400).json({ error: 'E-mail já cadastrado' });
      if (err.constraint?.includes('cpf')) return res.status(400).json({ error: 'CPF já cadastrado' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Remove autônomo: clínica + usuário + profissional
router.delete('/:clinicId', auth, adminOnly, async (req, res) => {
  const { clinicId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      'SELECT id FROM clinics WHERE id = $1 AND is_autonomous = true',
      [clinicId]
    );
    if (!check.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Autônomo não encontrado' });
    }

    // CASCADE cuida de profissionais, usuários, pacientes, appointments via FK
    await client.query('DELETE FROM clinics WHERE id = $1', [clinicId]);

    await client.query('COMMIT');
    res.json({ message: 'Autônomo removido com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
