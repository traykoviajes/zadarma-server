// Intercambia el `code` de Google por un refresh_token.
// Uso: node tools/get-token.js <CODE>

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const code = process.argv[2];
if (!code) {
  console.error('Uso: node tools/get-token.js <CODE>');
  console.error('Pega como argumento el `code` que aparece en la URL de redirección.');
  process.exit(1);
}

const credentialsPath = path.resolve('./oauth-client.json');
if (!fs.existsSync(credentialsPath)) {
  console.error(`No se encontró ${credentialsPath}.`);
  process.exit(1);
}

const { client_id, client_secret } =
  JSON.parse(fs.readFileSync(credentialsPath)).installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost'
);

(async () => {
  const { tokens } = await oauth2Client.getToken(code);

  console.log('Tokens recibidos:\n');
  console.log(JSON.stringify(tokens, null, 2));

  if (!tokens.refresh_token) {
    console.warn(
      '\n⚠ No se devolvió refresh_token. Probablemente ya lo emitiste antes.'
    );
    console.warn(
      '  Para forzar uno nuevo, revoca el acceso en https://myaccount.google.com/permissions'
    );
    console.warn('  y vuelve a generar la URL (node tools/generate-url.js).');
    return;
  }

  console.log('\nCopia este valor a GOOGLE_REFRESH_TOKEN en tu .env:\n');
  console.log(tokens.refresh_token);
})();
