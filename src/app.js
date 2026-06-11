const express = require('express');
const zadarmaWebhook = require('./routes/zadarmaWebhook');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Zadarma server running' });
});

app.use('/webhook/zadarma', zadarmaWebhook);

module.exports = app;
