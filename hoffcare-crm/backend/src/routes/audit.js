const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const canView = (user) => ['admin', 'responsavel'].includes(user.role);

// GET /api/audit — lista logs com filtros e paginação
// Query: action, entity, user_id, date_from, date_to, search, limit, offset
router.get('/', auth, async (req, res) => {
  if (!canView(req.user)) return res.status(403).json({ error: 'Acesso restrito a administradores' });

  const { action, entity, user_id, date_from, date_to, search } = req.query;
  const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const where = [];
  const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };

  // Admin sem clínica selecionada vê tudo; demais veem só a própria clínica
  if (req.user.clinic_id) add('clinic_id = ?', req.user.clinic_id);
  if (action)    add('action = ?', action);
  if (entity)    add('entity = ?', entity);
  if (user_id)   add('user_id = ?', user_id);
  if (date_from) add('created_at >= ?', date_from);
  if (date_to)   add('created_at < ?', `${date_to}T23:59:59.999`);
  if (search) {
    params.push(`%${search}%`);
    where.push(`(user_name ILIKE $${params.length} OR path ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT * FROM audit_logs ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs ${whereSql}`, params
    );
    res.json({ logs: rows, total: count, limit, offset });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/audit/filters — valores disponíveis para os filtros da tela
router.get('/filters', auth, async (req, res) => {
  if (!canView(req.user)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  const clinicFilter = req.user.clinic_id ? 'WHERE clinic_id = $1' : '';
  const params = req.user.clinic_id ? [req.user.clinic_id] : [];
  try {
    const [entities, users] = await Promise.all([
      pool.query(`SELECT DISTINCT entity FROM audit_logs ${clinicFilter} ORDER BY entity`, params),
      pool.query(`SELECT DISTINCT user_id, user_name FROM audit_logs ${clinicFilter} ORDER BY user_name`, params),
    ]);
    res.json({
      entities: entities.rows.map(r => r.entity).filter(Boolean),
      users: users.rows.filter(r => r.user_id),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
