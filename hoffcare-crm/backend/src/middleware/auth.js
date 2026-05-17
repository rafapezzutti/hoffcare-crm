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
      // clinic_id 0 = sem clínica selecionada, retorna null para filtrar tudo
      req.user = { ...decoded, clinic_id: clinicId === 0 ? null : clinicId };
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
