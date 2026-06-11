// Genera la URL de autorización de Google OAuth2.
// Ejecutar: node tools/generate-url.js
// Requisito previo: descargar el JSON de credenciales OAuth (Desktop app)
// y guardarlo como ./oauth-client.json

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const credentialsPath = path.resolve('./oauth-client.json');

if (!fs.existsSync(credentialsPath)) {
  console.error(`No se encontró ${credentialsPath}.`);
  console.error('Descarga el JSON de tu OAuth client (Desktop app) y guárdalo ahí.');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath));
const { client_id, client_secret } = credentials.installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost'
);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('Abre esta URL en tu navegador y autoriza con tu Gmail:\n');
console.log(url);
