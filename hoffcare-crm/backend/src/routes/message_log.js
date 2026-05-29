const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/message-log?year=&month=&channel=&type=
router.get('/', auth, async (req, res) => {
  const { year, month, channel, type } = req.query;
  const isAdmin = req.user.role === 'admin';
  const clinic_id = req.user.clinic_id;
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  const params = [y, m];
  const conditions = [
    `EXTRACT(YEAR FROM sent_at) = $1`,
    `EXTRACT(MONTH FROM sent_at) = $2`,
  ];

  if (!isAdmin) {
    conditions.push(`clinic_id = $${params.length + 1}`);
    params.push(clinic_id);
  }
  if (channel) { conditions.push(`channel = $${params.length + 1}`); params.push(channel); }
  if (type)    { conditions.push(`type = $${params.length + 1}`);    params.push(type); }

  try {
    const summary = await pool.query(`
      SELECT channel, type, type_label,
             COUNT(*) as total,
             COUNT(DISTINCT clinic_id) as clinics
      FROM message_log
      WHERE ${conditions.join(' AND ')}
      GROUP BY channel, type, type_label
      ORDER BY channel, total DESC
    `, params);

    let byClinic = [];
    if (isAdmin) {
      const res = await pool.query(`
        SELECT ml.clinic_id, c.name as clinic_name,
               ml.channel, COUNT(*) as total
        FROM message_log ml
        LEFT JOIN clinics c ON c.id = ml.clinic_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY ml.clinic_id, c.name, ml.channel
        ORDER BY total DESC
      `, params);
      byClinic = res.rows;
    }

    const totals = await pool.query(`
      SELECT channel, COUNT(*) as total
      FROM message_log
      WHERE ${conditions.join(' AND ')}
      GROUP BY channel
    `, params);

    res.json({ year: y, month: m, summary: summary.rows, by_clinic: byClinic, totals: totals.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
