const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://psaude.ia.br';

// Cria tabela de tokens se não existir
const ensureTokenTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
ensureTokenTable().catch(console.error);

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  try {
    const result = await pool.query(
      `SELECT u.*, c.is_autonomous
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const isAutonomous = !!user.is_autonomous;

    const token = jwt.sign(
      {
        id: user.id, email: user.email, role: user.role, clinic_id: user.clinic_id,
        is_autonomous: isAutonomous,
        is_trial: !!user.is_trial, trial_expires_at: user.trial_expires_at || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        clinic_id: user.clinic_id, is_autonomous: isAutonomous,
        is_trial: !!user.is_trial,
        trial_starts_at: user.trial_starts_at || null,
        trial_expires_at: user.trial_expires_at || null,
        trial_blocked_at: user.trial_blocked_at || null,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Esqueceu a senha — envia e-mail com link
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

  try {
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    // Responde sempre com sucesso para não revelar se e-mail existe
    if (!result.rows[0]) return res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções em instantes.' });

    const user = result.rows[0];

    // Invalida tokens anteriores deste usuário
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false', [user.id]);

    // Gera token seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: 'P. Soluções para Saúde <noreply@psaude.ia.br>',
      to: email,
      subject: 'Redefinição de senha — P. Soluções para Saúde',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
          <div style="background: #1a2535; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #4DB8E8; letter-spacing: 0.5px;">P. Soluções</div>
            <div style="font-size: 13px; font-weight: 600; color: #E8841A; letter-spacing: 1px;">para Saúde</div>
          </div>
          <div style="background: #fff; border: 1px solid #e9ecef; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
            <h2 style="margin: 0 0 8px; font-size: 18px; color: #1a2535;">Olá, ${user.name}!</h2>
            <p style="color: #495057; font-size: 14px; line-height: 1.6;">
              Recebemos uma solicitação para redefinir a senha da sua conta.
              Clique no botão abaixo para criar uma nova senha:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="
                background: #4DB8E8; color: white; text-decoration: none;
                padding: 13px 32px; border-radius: 6px; font-size: 15px;
                font-weight: 700; display: inline-block; letter-spacing: 0.3px;
              ">Redefinir minha senha</a>
            </div>
            <p style="color: #868e96; font-size: 12px; line-height: 1.5;">
              Este link é válido por <strong>1 hora</strong>.<br>
              Se você não solicitou a redefinição, ignore este e-mail — sua senha não será alterada.
            </p>
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0;" />
            <p style="color: #adb5bd; font-size: 11px; text-align: center; margin: 0;">
              P. Soluções para Saúde · Sistema de Gestão Clínica
            </p>
          </div>
        </div>
      `
    });

    res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções em instantes.' });
  } catch (err) {
    console.error('Erro forgot-password:', err);
    res.status(500).json({ error: 'Erro ao processar solicitação. Tente novamente.' });
  }
});

// Redefinir senha com token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
  if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });

  try {
    const result = await pool.query(
      `SELECT prt.*, u.email FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (!result.rows[0]) return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });

    const { user_id, id: tokenId } = result.rows[0];

    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenId]);

    res.json({ message: 'Senha redefinida com sucesso! Faça login com a nova senha.' });
  } catch (err) {
    console.error('Erro reset-password:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha. Tente novamente.' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.clinic_id,
              COALESCE(c.is_autonomous, false) as is_autonomous,
              u.is_trial, u.trial_starts_at, u.trial_expires_at, u.trial_blocked_at,
              COALESCE(u.can_use_ai_chat, false) as can_use_ai_chat
       FROM users u
       LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
