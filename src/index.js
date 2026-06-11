require('dotenv').config();

const { validateEnv } = require('./config/env');
const { startServer } = require('./server');

validateEnv();
startServer();
