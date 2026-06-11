const crypto = require('crypto');
const { getEnv } = require('../../config/env');

function encodeSignature(signatureString, secret) {
  const digest = crypto.createHmac('sha1', secret).update(signatureString).digest();
  return digest.toString('base64');
}

function verifyNotifyRecord(body, signatureHeader) {
  if (!signatureHeader) {
    return false;
  }

  const { zadarmaApiSecret } = getEnv();
  const signatureString = `${body.pbx_call_id || ''}${body.call_id_with_rec || ''}`;
  const expected = encodeSignature(signatureString, zadarmaApiSecret);

  const received = String(signatureHeader).trim();
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

module.exports = { encodeSignature, verifyNotifyRecord };
