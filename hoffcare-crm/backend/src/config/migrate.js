const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/001_initial.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
