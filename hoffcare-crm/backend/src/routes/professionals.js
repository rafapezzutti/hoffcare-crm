const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    // clinic_id já resolvido pelo middleware (header X-Clinic-Id para admin)
    const clinic_id = req.user.clinic_id;
    let query = 'SELECT * FROM professionals';
    const params = [];
    if (clinic_id) { query += ' WHERE clinic_id = $1'; params.push(clinic_id); }
    else { query += ' WHERE 1=0'; } // sem clínica selecionada = retorna vazio
    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const clinic_id = req.user.clinic_id;
    const result = await pool.query(
      'SELECT * FROM professionals WHERE id = $1 AND clinic_id = $2',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone, repasse_percentual, repasse_type, repasse_fixed } = req.body;
  if (!name)
    return res.status(400).json({ error: 'Nome é obrigatório' });

  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  // Apenas responsavel e admin podem definir o % de repasse
  const canEditRepasse = ['responsavel', 'admin'].includes(req.user.role);
  const repasseValue = canEditRepasse && repasse_percentual !== '' && repasse_percentual != null
    ? parseFloat(repasse_percentual) : null;

  try {
    const result = await pool.query(
      `INSERT INTO professionals (type, name, cpf, crm_cro, birthdate, email, phone, clinic_id, repasse_percentual, repasse_type, repasse_fixed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [type, name, cpf || null, crm_cro || null, birthdate || null, email || null, phone || null, clinic_id, repasseValue,
       repasse_type || 'percent', repasse_type === 'fixed' ? (parseFloat(repasse_fixed) || null) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'CPF já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { type, name, cpf, crm_cro, birthdate, email, phone, repasse_percentual, repasse_type, repasse_fixed } = req.body;
  const clinic_id = req.user.clinic_id;
  const canEditRepasse = ['responsavel', 'admin'].includes(req.user.role);

  try {
    // Usuário sem permissão preserva o valor atual do repasse no banco
    let repasseValue;
    if (canEditRepasse) {
      repasseValue = repasse_percentual !== '' && repasse_percentual != null
        ? parseFloat(repasse_percentual) : null;
    } else {
      const cur = await pool.query(
        'SELECT repasse_percentual FROM professionals WHERE id=$1 AND clinic_id=$2',
        [req.params.id, clinic_id]
      );
      repasseValue = cur.rows[0]?.repasse_percentual ?? null;
    }

    const result = await pool.query(
      `UPDATE professionals SET type=$1, name=$2, cpf=$3, crm_cro=$4, birthdate=$5, email=$6, phone=$7,
       repasse_percentual=$8, repasse_type=$9, repasse_fixed=$10
       WHERE id=$11 AND clinic_id=$12 RETURNING *`,
      [type, name, cpf || null, crm_cro || null, birthdate || null, email || null, phone || null,
       repasseValue, repasse_type || 'percent',
       repasse_type === 'fixed' ? (parseFloat(repasse_fixed) || null) : null,
       req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      'DELETE FROM professionals WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
    res.json({ message: 'Profissional removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
