require('dotenv').config();
const crypto = require('crypto');

const body = {
  event: 'NOTIFY_RECORD',
  pbx_call_id: 'in_37b89b64859f6a41b4ac1e3964b4c607820c0638',
  call_id_with_rec: '1781129241.26640977',
};

const received = 'NjJmYTBlNzQ4ZDQzZTM0NTlhY2FjZjM0ZDU3MWNiMmIyOTdlN2ZlNg==';
const secret = process.env.ZADARMA_API_SECRET;

if (!secret) {
  console.error('ZADARMA_API_SECRET no está definida en .env');
  process.exit(1);
}

const signatureString = `${body.pbx_call_id}${body.call_id_with_rec}`;
const hex = crypto.createHmac('sha1', secret).update(signatureString).digest('hex');
const expectedBase64 = Buffer.from(hex, 'utf8').toString('base64');

console.log('String firmado:', signatureString);
console.log('Secreto (primeros 6 chars):', secret.slice(0, 6) + '...');
console.log('HMAC-SHA1 (hex):    ', hex);
console.log('HMAC-SHA1 (base64): ', expectedBase64);
console.log('Recibido de Zadarma:', received);
console.log('¿Coincide base64?    ', expectedBase64 === received ? '✅ SÍ' : '❌ NO');

// Prueba también concatenación en el otro orden
const reversed = crypto
  .createHmac('sha1', secret)
  .update(`${body.call_id_with_rec}${body.pbx_call_id}`)
  .digest('hex');
const reversedBase64 = Buffer.from(reversed, 'utf8').toString('base64');
console.log('\nProbando orden invertido (call_id_with_rec + pbx_call_id):');
console.log('Resultado base64:    ', reversedBase64);
console.log('¿Coincide?           ', reversedBase64 === received ? '✅ SÍ' : '❌ NO');
