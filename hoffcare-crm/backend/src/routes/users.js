const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const router  = express.Router();

// ── Middleware: admin ou responsável ──────────────────────────────────────────
const adminOrResponsavel = (req, res, next) => {
  if (!['admin', 'responsavel'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }
  next();
};

// Roles que o responsável pode criar/editar em sua clínica
const RESPONSAVEL_ALLOWED_ROLES = ['user', 'recepcionista', 'profissional'];
// Roles que só o admin (Master) pode criar
const ADMIN_ONLY_ROLES = ['responsavel', 'admin'];

// ── GET /users ────────────────────────────────────────────────────────────────
router.get('/', auth, adminOrResponsavel, async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === 'admin') {
      query = `SELECT u.id, u.name, u.email, u.role, u.clinic_id, c.name as clinic_name, u.created_at,
                      u.is_trial, u.trial_starts_at, u.trial_expires_at, u.trial_blocked_at
               FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
               ORDER BY u.name`;
    } else {
      // responsavel vê apenas usuários da própria clínica (exceto admin/responsavel de outras clínicas)
      query = `SELECT u.id, u.name, u.email, u.role, u.clinic_id, c.name as clinic_name, u.created_at,
                      u.is_trial, u.trial_starts_at, u.trial_expires_at, u.trial_blocked_at
               FROM users u LEFT JOIN clinics c ON u.clinic_id = c.id
               WHERE u.clinic_id=$1 AND u.role NOT IN ('admin')
               ORDER BY u.name`;
      params = [req.user.clinic_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /users ───────────────────────────────────────────────────────────────
router.post('/', auth, adminOrResponsavel, async (req, res) => {
  const { name, email, password, role, clinic_id, is_trial, professional_type } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, senha, perfil' });

  // Responsável só pode criar roles permitidos para sua clínica
  if (req.user.role === 'responsavel') {
    if (!RESPONSAVEL_ALLOWED_ROLES.includes(role))
      return res.status(403).json({ error: 'Você pode criar: Usuário, Recepcionista ou Profissional.' });
  } else {
    // Admin não pode criar outro admin via API
    if (role === 'admin')
      return res.status(403).json({ error: 'O perfil Master não pode ser criado via interface.' });
    if (!['responsavel', ...RESPONSAVEL_ALLOWED_ROLES].includes(role))
      return res.status(400).json({ error: 'Perfil inválido.' });
  }

  // Clínica: responsavel usa a própria; admin precisa informar
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

    // ── Auto-criar profissional quando role = 'profissional' ──────────────────
    if (role === 'profissional' && targetClinic) {
      const profType = professional_type || 'dentista';
      await pool.query(
        `INSERT INTO professionals (type, name, email, clinic_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [profType, name, email, targetClinic]
      );
    }

    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /users/:id/c