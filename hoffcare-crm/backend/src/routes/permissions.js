const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Módulos do sistema e seus labels
const MODULES = [
  { key: 'agenda',        label: 'Agenda / Calendário' },
  { key: 'patients',      label: 'Pacientes' },
  { key: 'records',       label: 'Prontuários' },
  { key: 'professionals', label: 'Profissionais' },
  { key: 'rooms',         label: 'Salas' },
  { key: 'procedures',    label: 'Procedimentos' },
  { key: 'anamnesis',     label: 'Anamnese Digital' },
  { key: 'before_after',  label: 'Fotos Antes/Depois' },
  { key: 'rentals',       label: 'Locações' },
  { key: 'settlements',   label: 'Acertos Financeiros' },
  { key: 'statement',     label: 'Extrato Mensal' },
  { key: 'bank_statement',label: 'Extrato Bancário' },
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'users',         label: 'Usuários' },
];

// Permissões padrão por role
const ROLE_DEFAULTS = {
  admin:        { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
  responsavel:  { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  },
  user:         { can_view: true,  can_create: true,  can_edit: true,  can_delete: false },
  recepcionista:{ can_view: true,  can_create: true,  can_edit: false, can_delete: false },
};

// Módulos restritos por role (false = sem acesso padrão)
const ROLE_RESTRICTIONS = {
  user:         ['users', 'clinics'],
  recepcionista:['users', 'clinics', 'rentals', 'settlements', 'statement', 'bank_statement'],
};

// GET /api/permissions — lista permissões da clínica
router.get('/', auth, async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      `SELECT id, name, email, role FROM users WHERE clinic_id=$1 AND is_trial=false ORDER BY name`,
      [req.user.clinic_id]
    );
    const { rows: overrides } = await pool.query(
      `SELECT * FROM user_permissions WHERE clinic_id=$1`,
      [req.user.clinic_id]
    );

    const overrideMap = {};
    overrides.forEach(o => {
      if (!overrideMap[o.user_id]) overrideMap[o.user_id] = {};
      overrideMap[o.user_id][o.module] = o;
    });

    const result = users.map(u => {
      const roleDefaults = ROLE_DEFAULTS[u.role] || ROLE_DEFAULTS.user;
      const restricted = ROLE_RESTRICTIONS[u.role] || [];
      const modules = MODULES.map(mod => {
        const override = overrideMap[u.id]?.[mod.key];
        const isRestricted = restricted.includes(mod.key);
        return {
          module: mod.key,
          label: mod.label,
          can_view:   override?.can_view   ?? (!isRestricted && roleDefaults.can_view),
          can_create: override?.can_create ?? (!isRestricted && roleDefaults.can_create),
          can_edit:   override?.can_edit   ?? (!isRestricted && roleDefaults.can_edit),
          can_delete: override?.can_delete ?? (!isRestricted && roleDefaults.can_delete),
          is_override: !!override,
        };
      });
      return { ...u, modules };
    });

    res.json({ users: result, module_list: MODULES });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/permissions/:user_id/:module — salva override
router.put('/:user_id/:module', auth, async (req, res) => {
  const { can_view, can_create, can_edit, can_delete } = req.body;
  const { user_id, module } = req.params;
  try {
    await pool.query(
      `INSERT INTO user_permissions (clinic_id, user_id, module, can_view, can_create, can_edit, can_delete)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (clinic_id, user_id, module)
       DO UPDATE SET can_view=$4, can_create=$5, can_edit=$6, can_delete=$7`,
      [req.user.clinic_id, user_id, module, !!can_view, !!can_create, !!can_edit, !!can_delete]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/permissions/:user_id/:module — remove override (volta ao padrão do role)
router.delete('/:user_id/:module', auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM user_permissions WHERE clinic_id=$1 AND user_id=$2 AND module=$3`,
      [req.user.clinic_id, req.params.user_id, req.params.module]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/permissions/modules — lista módulos disponíveis
router.get('/modules', auth, (req, res) => res.json(MODULES));

// GET /api/permissions/ai-chat — status Talk to Me de todos os usuários da clínica
router.get('/ai-chat', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, COALESCE(can_use_ai_chat, false) as can_use_ai_chat
       FROM users WHERE clinic_id = $1 AND is_trial = false ORDER BY name`,
      [req.user.clinic_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/permissions/:user_id/ai-chat — habilita ou desabilita Talk to Me para um usuário
router.put('/:user_id/ai-chat', auth, async (req, res) => {
  const canManage = req.user.role === 'admin' || req.user.role === 'responsavel';
  if (!canManage) return res.status(403).json({ error: 'Sem permissão para alterar acesso à IA.' });
  const { enabled } = req.body;
  try {
    await pool.query(
      `UPDATE users SET can_use_ai_chat = $1 WHERE id = $2 AND clinic_id = $3`,
      [!!enabled, req.params.user_id, req.user.clinic_id]
    );
    res.json({ ok: true, can_use_ai_chat: !!enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
