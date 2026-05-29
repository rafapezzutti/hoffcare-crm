const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { sendText, getQRCode, getConnectionState } = require('../services/whatsapp');

// ── GET /api/whatsapp/settings
// Retorna configurações por clínica (apenas toggles — token é global via env vars)
router.get('/settings', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
              whatsapp_cancel, whatsapp_reminder_hours
       FROM clinics WHERE id = $1`,
      [req.user.clinic_id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/whatsapp/settings
// Salva apenas toggles por clínica (token é global via env vars)
router.put('/settings', auth, async (req, res) => {
  const {
    whatsapp_enabled, whatsapp_confirm, whatsapp_reminder,
    whatsapp_cancel, whatsapp_reminder_hours
  } = req.body;

  try {
    await pool.query(
      `UPDATE clinics SET
         whatsapp_enabled=$1, whatsapp_confirm=$2, whatsapp_reminder=$3,
         whatsapp_cancel=$4, whatsapp_reminder_hours=$5
       WHERE id=$6`,
      [!!whatsapp_enabled, !!whatsapp_confirm, !!whatsapp_reminder,
       !!whatsapp_cancel, whatsapp_reminder_hours || 24,
       req.user.clinic_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/whatsapp/test
// Envia mensagem de teste usando as credenciais globais (env vars)
router.post('/test', auth, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Número obrigatório' });

  try {
    const msg = `✅ *P. Soluções para Saúde*\n\nTeste de integração WhatsApp realizado com sucesso! 🎉`;
    const r = await sendText(phone, msg);

    if (r.ok) res.json({ ok: true, message: 'Mensagem enviada com sucesso!' });
    else {
      const detail = typeof r.error === 'object' ? JSON.stringify(r.error) : String(r.error);
      res.status(400).json({ error: 'Falha ao enviar. Verifique a conexão da Evolution API.', detail });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/whatsapp/status
// Retorna estado da conexão da instância Evolution API
router.get('/status', auth, async (req, res) => {
  try {
    const r = await getConnectionState();
    res.json(r.ok ? r.data : { error: r.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/whatsapp/qrcode
// Retorna QR code para conectar o WhatsApp na instância
router.get('/qrcode', auth, async (req, res) => {
  try {
    const r = await getQRCode();
    res.json(r.ok ? r.data : { error: r.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
