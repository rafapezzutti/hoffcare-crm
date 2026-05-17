const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const email = 'rafael.pezzutti@gmail.com';
const novaSenha = 'admin123';

bcrypt.hash(novaSenha, 10).then(hash => {
  pool.query(
    'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, name, email',
    [hash, email]
  ).then(r => {
    if (r.rows.length === 0) {
      console.log('Usuário não encontrado com esse email. Listando todos os usuários:');
      return pool.query('SELECT id, name, email, role FROM users').then(all => {
        console.log(all.rows);
        pool.end();
      });
    }
    console.log('✅ Senha resetada com sucesso!');
    console.log('Usuário:', r.rows[0]);
    console.log('Nova senha: ' + novaSenha);
    pool.end();
  });
}).catch(err => {
  console.error('Erro:', err.message);
  pool.end();
});
