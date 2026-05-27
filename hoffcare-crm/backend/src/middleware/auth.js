const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Admin pode trocar de clínica via header X-Clinic-Id
    if (decoded.role === 'admin' && req.headers['x-clinic-id'] !== undefined) {
      const clinicId = parseInt(req.headers['x-clinic-id']);
      req.user = { ...decoded, clinic_id: clinicId === 0 ? null : clinicId };
    }

    // Bloqueia usuário trial expirado (exceto admin)
    if (decoded.is_trial && decoded.trial_expires_at && decoded.role !== 'admin') {
      if (new Date() > new Date(decoded.trial_expires_at)) {
        return res.status(403).json({
          error: 'Período de teste encerrado. Entre em contato para contratar o plano.',
          code: 'TRIAL_EXPIRED',
        });
      }
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
};

module.exports = { auth, adminOnly };
