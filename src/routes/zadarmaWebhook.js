const express = require('express');
const { verifyNotifyRecord } = require('../services/zadarma/signature');
const { processRecording } = require('../services/zadarma/processRecording');
const { getEnv } = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.query.zd_echo != null) {
    res.type('text/plain').send(String(req.query.zd_echo));
    return;
  }

  res.status(200).send('ok');
});

router.post('/', express.urlencoded({ extended: true }), (req, res) => {
  const signature = req.get('Signature') || req.get('signature');
  const body = req.body || {};

  if (body.event !== 'NOTIFY_RECORD') {
    res.sendStatus(200);
    return;
  }

  const { verifyWebhookSignature } = getEnv();
  if (verifyWebhookSignature && !verifyNotifyRecord(body, signature)) {
    console.warn(
      '[webhook] Firma inválida para NOTIFY_RECORD',
      { receivedSignature: signature, body }
    );
    res.sendStatus(403);
    return;
  }

  if (!verifyWebhookSignature) {
    console.warn(
      '[webhook] VERIFY_WEBHOOK_SIGNATURE=false — firma NO verificada'
    );
  }

  const { call_id_with_rec: callIdWithRec, pbx_call_id: pbxCallId } = body;

  if (!callIdWithRec && !pbxCallId) {
    console.warn('[webhook] NOTIFY_RECORD sin identificadores de llamada');
    res.sendStatus(400);
    return;
  }

  console.log(
    `[webhook] NOTIFY_RECORD recibido pbx_call_id=${pbxCallId} call_id_with_rec=${callIdWithRec}`
  );
  console.log(`[webhook] NOTIFY_RECORD body=${JSON.stringify(body)}`);

  res.sendStatus(200);

  setImmediate(() => {
    processRecording(body).catch((error) => {
      console.error(
        `[recording] Error final pbx_call_id=${pbxCallId} call_id_with_rec=${callIdWithRec}:`,
        error.message
      );
    });
  });
});

module.exports = router;
