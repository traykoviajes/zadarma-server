const app = require('./app');

const { getEnv } = require('./config/env');

const { port: PORT } = getEnv();

function startServer() {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = { startServer };
