const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/inventory/items — list all active items for clinic
router.get('/items', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT * FROM inventory_items
       WHERE clinic_id = $1 AND active = true
       ORDER BY category, name`,
      [clinic_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/items — create item
router.post('/items', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.status(400).json({ error: 'Selecione uma clínica antes de cadastrar' });

  const { name, category, unit, current_stock, min_stock, unit_cost, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const result = await pool.query(
      `INSERT INTO inventory_items
         (clinic_id, name, category, unit, current_stock, min_stock, unit_cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        clinic_id,
        name,
        category || null,
        unit || null,
        current_stock != null ? current_stock : 0,
        min_stock != null ? min_stock : 0,
        unit_cost != null ? unit_cost : null,
        notes || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inventory/items/:id — update item
router.put('/items/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const { name, category, unit, current_stock, min_stock, unit_cost, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE inventory_items
       SET name=$1, category=$2, unit=$3, current_stock=$4, min_stock=$5,
           unit_cost=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 AND clinic_id=$9
       RETURNING *`,
      [
        name,
        category || null,
        unit || null,
        current_stock != null ? current_stock : 0,
        min_stock != null ? min_stock : 0,
        unit_cost != null ? unit_cost : null,
        notes || null,
        req.params.id,
        clinic_id,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventory/items/:id — soft delete
router.delete('/items/:id', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  try {
    const result = await pool.query(
      `UPDATE inventory_items SET active = false, updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2
       RETURNING id`,
      [req.params.id, clinic_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ message: 'Item desativado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/movements — add movement
router.post('/movements', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  const user_id = req.user.id;
  const { item_id, type, quantity, unit_cost, notes, record_id } = req.body;

  if (!['entrada', 'saida', 'ajuste'].includes(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Use: entrada, saida ou ajuste' });
  }
  if (!item_id || quantity == null) {
    return res.status(400).json({ error: 'item_id e quantity são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the item row for update
    const itemRes = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND clinic_id = $2 AND active = true FOR UPDATE',
      [item_id, clinic_id]
    );
    if (!itemRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const item = itemRes.rows[0];
    const currentStock = parseFloat(item.current_stock);
    const qty = parseFloat(quantity);
    let newStock;
    let newUnitCost = item.unit_cost;

    if (type === 'entrada') {
      newStock = currentStock + qty;
      if (unit_cost != null) newUnitCost = unit_cost;
    } else if (type === 'saida') {
      if (currentStock < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Estoque insuficiente para realizar a saída' });
      }
      newStock = currentStock - qty;
    } else {
      // ajuste: set absolute value
      newStock = qty;
    }

    // Insert movement
    const movRes = await client.query(
      `INSERT INTO inventory_movements
         (clinic_id, item_id, type, quantity, unit_cost, notes, record_id, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        clinic_id,
        item_id,
        type,
        qty,
        unit_cost != null ? unit_cost : null,
        notes || null,
        record_id || null,
        user_id,
      ]
    );

    // Update item stock (and unit_cost if entrada with provided cost)
    await client.query(
      `UPDATE inventory_items
       SET current_stock = $1, unit_cost = $2, updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4`,
      [newStock, newUnitCost, item_id, clinic_id]
    );

    await client.query('COMMIT');
    res.status(201).json(movRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/inventory/movements — list movements for clinic
router.get('/movements', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json([]);
  const { item_id, limit } = req.query;
  const params = [clinic_id];
  const conditions = ['m.clinic_id = $1'];

  if (item_id) {
    conditions.push(`m.item_id = $${params.length + 1}`);
    params.push(item_id);
  }

  params.push(parseInt(limit) || 50);
  const limitParam = `$${params.length}`;

  try {
    const result = await pool.query(
      `SELECT m.*,
              i.name AS item_name,
              u.name AS user_name
       FROM inventory_movements m
       LEFT JOIN inventory_items i ON i.id = m.item_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC
       LIMIT ${limitParam}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/low-stock — items at or below min_stock
router.get('/low-stock', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json({ count: 0, items: [] });
  try {
    const result = await pool.query(
      `SELECT * FROM inventory_items
       WHERE clinic_id = $1 AND active = true AND current_stock <= min_stock
       ORDER BY category, name`,
      [clinic_id]
    );
    res.json({ count: result.rows.length, items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/summary
router.get('/summary', auth, async (req, res) => {
  const clinic_id = req.user.clinic_id;
  if (!clinic_id) return res.json({ total_items: 0, low_stock_count: 0, total_value: 0, low_stock_items: [] });
  try {
    const [summaryRes, lowStockRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) AS total_items,
           SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) AS low_stock_count,
           COALESCE(SUM(current_stock * COALESCE(unit_cost, 0)), 0) AS total_value
         FROM inventory_items
         WHERE clinic_id = $1 AND active = true`,
        [clinic_id]
      ),
      pool.query(
        `SELECT * FROM inventory_items
         WHERE clinic_id = $1 AND active = true AND current_stock <= min_stock
         ORDER BY category, name`,
        [clinic_id]
      ),
    ]);

    const s = summaryRes.rows[0];
    res.json({
      total_items: parseInt(s.total_items) || 0,
      low_stock_count: parseInt(s.low_stock_count) || 0,
      total_value: parseFloat(s.total_value) || 0,
      low_stock_items: lowStockRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
