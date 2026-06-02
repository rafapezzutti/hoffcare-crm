require('dotenv').config();
const https = require('https');
const { GoogleAuth } = require('google-auth-library');

async function main() {
  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
    scopes: ['https://www.googleapis.com/auth/generative-language'],
  });
  const token = await auth.getAccessToken();

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models?pageSize=50',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const json = JSON.parse(data);
      if (json.error) { console.error('Erro:', json.error.message); return; }
      const gemini = json.models?.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'));
      console.log('Modelos Gemini disponíveis com generateContent:');
      gemini?.forEach(m => console.log(' -', m.name));
    });
  });
}
main();
