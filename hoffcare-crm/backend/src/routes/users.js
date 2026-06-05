const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const router  = express.Router();

const adminOrResponsavel = (req, res, next) => {
  if (!['admin', 'responsavel'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso nao autorizado' });
  }
  next();
};

const RESPONSAVEL_ALLOWED_ROLES = ['user', 'recepcionista', 'profissional'];
const ADMIN_ONLY_ROLES = ['responsavel', 'admin'];

router.get('/', auth, adminOrResponsavel, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === 'admin') {
      query = `SELECT u.id, u.name, u.email, u.role, u.clinic_id, c.name as clinic_name, u.created_at,
                      u.is_trial, u.trial_starts_at, u.trial_expires_at, u.trial_blocked_at
               FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id ORDER BY u.name`;
    } else {
      query = `SELECT u.id, u.name, u.email, u.role, u.clinic_id, c.name as clinic_name, u.created_at,
                      u.is_trial, u.trial_starts_at, u.trial_expires_at, u.trial_blocked_at
               FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
               WHERE u.clinic_id=$1 AND u.role NOT IN ('admin') ORDER BY u.name`;
      params = [req.user.clinic_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, adminOrResponsavel, async (req, res) => {
  const { name, email, password, role, clinic_id, is_trial, professional_type } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Campos obrigatorios: nome, email, senha, perfil' });
  if (req.user.role === 'responsavel') {
    if (!RESPONSAVEL_ALLOWED_ROLES.includes(role))
      return res.status(403).json({ error: 'Voce pode criar: Usuario, Recepcionista ou Profissional.' });
  } else {
    if (role === 'admin') return res.status(403).json({ error: 'Perfil Master nao pode ser criado via interface.' });
    if (!['responsavel', ...RESPONSAVEL_ALLOWED_ROLES].includes(role))
      return res.status(400).json({ error: 'Perfil invalido.' });
  }
  const targetClinic = req.user.role === 'responsavel' ? req.user.clinic_id : (clinic_id || null);
  try {
    const hashed = await bcrypt.hash(password, 10);
    const trialStartsAt  = is_trial ? new Date() : null;
    const trialExpiresAt = is_trial ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) : null;
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, clinic_id, is_trial, trial_starts_at, trial_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, email, role, clinic_id, is_trial, trial_starts_at, trial_expires_at`,
      [name, email, hashed, role, targetClinic, !!is_trial, trialStartsAt, trialExpiresAt]
    );
    const newUser = result.rows[0];
    if (role === 'profissional' && targetClinic) {
      const profType = professional_type || 'dentista';
      await pool.query(
        `INSERT INTO professionals (type, name, email, clinic_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [profType, name, email, targetClinic]
      );
    }
    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email ja cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/convert-trial', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_trial=FALSE, trial_expires_at=NULL, trial_starts_at=NULL, trial_blocked_at=NULL
       WHERE id=$1 RETURNING id, name, email, role, is_trial`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, adminOrResponsavel, async (req, res) => {
  const { name, email, password, role, clinic_id } = req.body;
  if (role === 'admin') return res.status(403).json({ error: 'Nao e possivel atribuir o perfil Master.' });
  const { rows: target } = await pool.query('SELECT email, clinic_id, role FROM users WHERE id=$1', [req.params.id]);
  if (!target[0]) return res.status(404).json({ error: 'Usuario nao encontrado' });
  if (target[0].email === 'rafael.pezzutti@gmail.com')
    return res.status(403).json({ error: 'O usuario Master nao pode ser editado.' });
  if (req.user.role === 'responsavel') {
    if (target[0].clinic_id !== req.user.clinic_id)
      return res.status(403).json({ error: 'Voce nao pode editar usuarios de outra clinica.' });
    if (!RESPONSAVEL_ALLOWED_ROLES.includes(role))
      return res.status(403).json({ error: 'Voce pode atribuir: Usuario, Recepcionista ou Profissional.' });
    if (ADMIN_ONLY_ROLES.includes(target[0].role))
      return res.status(403).json({ error: 'Voce nao pode editar este perfil.' });
  }
  const targetClinic = req.user.role === 'responsavel' ? req.user.clinic_id : (clinic_id || null);
  try {
    let query, params;
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query  = `UPDATE users SET name=$1, email=$2, password=$3, role=$4, clinic_id=$5 WHERE id=$6 RETURNING id, name, email, role, clinic_id`;
      params = [name, email, hashed, role, targetClinic, req.params.id];
    } else {
      query  = `UPDATE users SET name=$1, email=$2, role=$3, clinic_id=$4 WHERE id=$5 RETURNING id, name, email, role, clinic_id`;
      params = [name, email, role, targetClinic, req.params.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, adminOrResponsavel, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT email, clinic_id, role FROM users WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario nao encontrado' });
    if (rows[0].email === 'rafael.pezzutti@gmail.com')
      return res.status(403).json({ error: 'O usuario Master nao pode ser removido.' });
    if (req.user.role === 'responsavel') {
      if (rows[0].clinic_id !== req.user.clinic_id)
        return res.status(403).json({ error: 'Voce nao pode remover usuarios de outra clinica.' });
      if (ADMIN_ONLY_ROLES.includes(rows[0].role))
        return res.status(403).json({ error: 'Voce nao pode remover este perfil.' });
    }
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ message: 'Usuario removido' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
