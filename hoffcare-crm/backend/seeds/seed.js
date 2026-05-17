require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create default admin clinic
    const clinicResult = await client.query(
      `INSERT INTO clinics (name, phone, email)
       VALUES ('HoffCare Clínica Principal', '(00) 0000-0000', 'contato@hoffcare.com.br')
       ON CONFLICT DO NOTHING RETURNING id`
    );

    let clinicId = clinicResult.rows[0]?.id;
    if (!clinicId) {
      const existing = await client.query("SELECT id FROM clinics LIMIT 1");
      clinicId = existing.rows[0]?.id;
    }

    // Create default admin user
    const hashed = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (name, email, password, role, clinic_id)
       VALUES ('Administrador', 'admin@hoffcare.com.br', $1, 'admin', $2)
       ON CONFLICT (email) DO NOTHING`,
      [hashed, clinicId]
    );

    // Load procedures SQL
    const proceduresSql = fs.readFileSync(path.join(__dirname, 'procedures.sql'), 'utf8');
    await client.query(proceduresSql);

    await client.query('COMMIT');
    console.log('Seed completed!');
    console.log('Admin login: admin@hoffcare.com.br / admin123');
    console.log('IMPORTANT: Change the admin password after first login!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
