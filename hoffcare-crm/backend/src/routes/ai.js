/**
 * routes/ai.js
 * Talk to Me — chat com Gemini com rate limiting por usuário.
 *
 * Limites diários (reset à meia-noite horário São Paulo):
 *   - 20 chamadas / dia / usuário
 *   - 2  imagens  / dia / usuário
 */

const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const { chat } = require('../services/geminiChat');

const router = express.Router();

const DAILY_CALL_LIMIT  = 20;
const DAILY_IMAGE_LIMIT = 2;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Retorna o registro de uso de hoje para o usuário (cria se não existir). */
async function getTodayUsage(userId) {
  // INSERT e SELECT separados — pg não suporta múltiplos statements num único query()
  await pool.query(
    `INSERT INTO ai_usage (user_id, usage_date, call_count, image_count)
     VALUES ($1, (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE, 0, 0)
     ON CONFLICT (user_id, usage_date) DO NOTHING`,
    [userId]
  );
  const { rows } = await pool.query(
    `SELECT call_count, image_count FROM ai_usage
     WHERE user_id = $1
       AND usage_date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE`,
    [userId]
  );
  return rows[0] || { call_count: 0, image_count: 0 };
}

/** Incrementa os contadores após chamada bem-sucedida. */
async function incrementUsage(userId, imageCount) {
  await pool.query(
    `INSERT INTO ai_usage (user_id, usage_date, call_count, image_count)
     VALUES ($1, (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE, 1, $2)
     ON CONFLICT (user_id, usage_date)
     DO UPDATE SET
       call_count  = ai_usage.call_count  + 1,
       image_count = ai_usage.image_count + $2`,
    [userId, imageCount]
  );
}

// ── GET /api/ai/usage ─────────────────────────────────────────────────────────

router.get('/usage', auth, async (req, res) => {
  try {
    const usage = await getTodayUsage(req.user.id);
    res.json({
      call_count:       usage.call_count,
      image_count:      usage.image_count,
      call_limit:       DAILY_CALL_LIMIT,
      image_limit:      DAILY_IMAGE_LIMIT,
      calls_remaining:  Math.max(0, DAILY_CALL_LIMIT  - usage.call_count),
      images_remaining: Math.max(0, DAILY_IMAGE_LIMIT - usage.image_count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────

/**
 * Body:
 * {
 *   history: [
 *     { role: 'user',  text: '...', images: [{mimeType, data}], audio: {mimeType, data} },
 *     { role: 'model', text: '...' },
 *     ...
 *   ]
 * }
 */
router.post('/chat', auth, async (req, res) => {
  try {
    // 1. Verifica permissão
    const { rows: userRows } = await pool.query(
      'SELECT can_use_ai_chat FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userRows[0]?.can_use_ai_chat) {
      return res.status(403).json({
        error: 'Acesso ao Talk to Me não habilitado. Solicite ao administrador.',
        code: 'AI_NOT_ENABLED',
      });
    }

    // 2. Verifica rate limit
    const usage = await getTodayUsage(req.user.id);

    if (usage.call_count >= DAILY_CALL_LIMIT) {
      return res.status(429).json({
        error: `Limite diário de ${DAILY_CALL_LIMIT} usos atingido. Retorna amanhã! 🌅`,
        code: 'LIMIT_CALLS',
        usage,
      });
    }

    // Conta imagens na última mensagem (a do usuário atual)
    const { history = [] } = req.body;
    const lastMsg    = history[history.length - 1];
    const imageCount = Array.isArray(lastMsg?.images) ? lastMsg.images.length : 0;

    if (imageCount > 0 && usage.image_count + imageCount > DAILY_IMAGE_LIMIT) {
      return res.status(429).json({
        error: `Limite diário de ${DAILY_IMAGE_LIMIT} imagens atingido. Retorna amanhã! 🌅`,
        code: 'LIMIT_IMAGES',
        usage,
      });
    }

    if (!history.length) {
      return res.status(400).json({ error: 'Histórico de mensagens vazio.' });
    }

    // 3. Chama Gemini
    const result = await chat(history);

    // 4. Incrementa uso
    await incrementUsage(req.user.id, imageCount);

    // 5. Retorna resposta + uso atualizado
    const updatedUsage = await getTodayUsage(req.user.id);
    res.json({
      ...result,
      usage: {
        call_count:       updatedUsage.call_count,
        image_count:      updatedUsage.image_count,
        calls_remaining:  Math.max(0, DAILY_CALL_LIMIT  - updatedUsage.call_count),
        images_remaining: Math.max(0, DAILY_IMAGE_LIMIT - updatedUsage.image_count),
      },
    });

  } catch (err) {
    console.error('[AI-CHAT] Erro:', err.message);
    if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Limite do serviço de IA atingido. Tente em alguns minutos.' });
    }
    res.status(500).json({ error: 'Erro ao processar mensagem: ' + err.message });
  }
});

module.exports = router;
