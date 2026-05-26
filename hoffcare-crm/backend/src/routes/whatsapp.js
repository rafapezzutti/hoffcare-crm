const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// ── GET /api/whatsapp/settings
router.get('/settings', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
              whatsapp_cancel, whatsapp_reminder_hours,
              whatsapp_instance_id,
              CASE WHEN whatsapp_token IS NOT NULL THEN '***' ELSE NULL END as whatsapp_token_set
       FROM clinics WHERE id = $1`,
      [req.user.clinic_id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/whatsapp/settings
router.put('/settings', auth, async (req, res) => {
  const {
    whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
    whatsapp_cancel, whatsapp_reminder_hours,
    whatsapp_instance_id, whatsapp_token
  } = req.body;

  try {
    let query, values;
    if (whatsapp_token && whatsapp_token !== '***') {
      query = `UPDATE clinics SET
        whatsapp_enabled=$1, whatsapp_confirm=$2, whatsapp_reminder=$3,
        whatsapp_cancel=$4, whatsapp_reminder_hours=$5,
        whatsapp_instance_id=$6, whatsapp_token=$7
        WHERE id=$8`;
      values = [whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
        whatsapp_cancel, whatsapp_reminder_hours || 24,
        whatsapp_instance_id, whatsapp_token, req.user.clinic_id];
    } else {
      query = `UPDATE clinics SET
        whatsapp_enabled=$1, whatsapp_confirm=$2, whatsapp_reminder=$3,
        whatsapp_cancel=$4, whatsapp_reminder_hours=$5,
        whatsapp_instance_id=$6
        WHERE id=$7`;
      values = [whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
        whatsapp_cancel, whatsapp_reminder_hours || 24,
        whatsapp_instance_id, req.user.clinic_id];
    }

    await pool.query(query, values);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/whatsapp/test
router.post('/test', auth, async (req, res) => {
  const { phone, clinic_id } = req.body;
  if (!phone) return res.status(400).json({ error: 'Número obrigatório' });

  // Admins podem testar qualquer clínica passando clinic_id; fallback para a própria clínica
  const targetClinicId = clinic_id || req.user.clinic_id;

  try {
    const result = await pool.query(
      'SELECT whatsapp_instance_id, whatsapp_token, whatsapp_security_token FROM clinics WHERE id = $1',
      [targetClinicId]
    );
    const { whatsapp_instance_id, whatsapp_token, whatsapp_security_token } = result.rows[0] || {};
    if (!whatsapp_instance_id || !whatsapp_token)
      return res.status(400).json({ error: 'Configure o Instance ID e Token antes de testar' });

    const { sendText } = require('../services/whatsapp');
    const msg = `✅ *P. Soluções para Saúde*\n\nTeste de integração WhatsApp realizado com sucesso! 🎉`;
    const r = await sendText(whatsapp_instance_id, whatsapp_token, phone, msg, whatsapp_security_token);

    if (r.ok) res.json({ ok: true, message: 'Mensagem enviada com sucesso!' });
    else {
      console.error('[WhatsApp test] Z-API error:', JSON.stringify(r.error));
      const detail = typeof r.error === 'object' ? JSON.stringify(r.error) : String(r.error);
      res.status(400).json({ error: 'Falha ao enviar. Verifique Instance ID e Token.', detail });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
