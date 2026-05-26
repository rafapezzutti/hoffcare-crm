const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrate() {
  const migrationsDir = path.join(__dirname, '../../migrations');

  // Garante que a tabela de controle existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Lê todos os arquivos .sql em ordem alfabética
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Verifica se já foi aplicada
    const { rows } = await pool.query(
      'SELECT filename FROM _migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`  ✓ ${file} (já aplicada)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✅ ${file} aplicada`);
    } catch (err) {
      console.error(`  ❌ ${file} erro: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('Migrations concluídas!');
  await pool.end();
}

migrate();
