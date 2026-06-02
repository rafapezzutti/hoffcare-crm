/**
 * Teste do OCR — rode com: node test-ocr.js caminho/para/imagem.jpg
 * Exemplo: node test-ocr.js C:\Users\rafae\Downloads\foto.jpg
 */

const fs   = require('fs');
const path = require('path');
const FormData = require('form-data');

// ── Configuração ──────────────────────────────────────────────────────────────
const API_URL = 'http://localhost:3001';
const TOKEN   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJyYWZhZWwucGV6enV0dGlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiY2xpbmljX2lkIjpudWxsLCJpc19hdXRvbm9tb3VzIjpmYWxzZSwiaXNfdHJpYWwiOmZhbHNlLCJ0cmlhbF9leHBpcmVzX2F0IjpudWxsLCJpYXQiOjE3ODA0NDI2OTIsImV4cCI6MTc4MDQ4NTg5Mn0.IQj99htKlUZ6Ar2YcLoDMfiiyKIrlTMnh9fCJvPPbAo';
const TYPE    = 'patient'; // patient | anamnesis | financial | evolution

// ── Arquivo de imagem (argumento ou padrão) ───────────────────────────────────
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('❌ Uso: node test-ocr.js <caminho-da-imagem>');
  console.error('   Exemplo: node test-ocr.js C:\\Users\\rafae\\Downloads\\foto.jpg');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ Arquivo não encontrado: ${imagePath}`);
  process.exit(1);
}

// ── Envio ─────────────────────────────────────────────────────────────────────
async function main() {
  const http = require('http');

  const form = new FormData();
  form.append('type', TYPE);
  form.append('image', fs.createReadStream(imagePath), {
    filename: path.basename(imagePath),
    contentType: imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
  });

  const headers = {
    ...form.getHeaders(),
    'Authorization': `Bearer ${TOKEN}`,
  };

  console.log(`📸 Enviando imagem: ${path.basename(imagePath)}`);
  console.log(`🔍 Tipo de documento: ${TYPE}`);
  console.log('⏳ Aguarde...\n');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/ocr/extract',
    method: 'POST',
    headers,
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.success) {
          console.log('✅ Dados extraídos com sucesso!\n');
          console.log(JSON.stringify(json.data, null, 2));
        } else {
          console.error('❌ Erro:', json.error);
        }
      } catch {
        console.error('❌ Resposta inválida:', data);
      }
    });
  });

  req.on('error', err => console.error('❌ Erro de conexão:', err.message));
  form.pipe(req);
}

main();
