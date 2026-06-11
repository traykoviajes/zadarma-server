function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variable de entorno requerida: ${name}`);
  }
  return value.trim();
}

function validateEnv() {
  requireEnv('ZADARMA_API_KEY');
  requireEnv('ZADARMA_API_SECRET');
  requireEnv('GOOGLE_CLIENT_ID');
  requireEnv('GOOGLE_CLIENT_SECRET');
  requireEnv('GOOGLE_REFRESH_TOKEN');
  requireEnv('GOOGLE_DRIVE_FOLDER_ID');
}

function getEnv() {
  return {
    zadarmaApiKey: requireEnv('ZADARMA_API_KEY'),
    zadarmaApiSecret: requireEnv('ZADARMA_API_SECRET'),
    recordDownloadDelayMs: Number(process.env.RECORD_DOWNLOAD_DELAY_MS) || 40000,
    googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
    googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    googleRefreshToken: requireEnv('GOOGLE_REFRESH_TOKEN'),
    googleDriveFolderId: requireEnv('GOOGLE_DRIVE_FOLDER_ID'),
    port: Number(process.env.PORT) || 3000,
  };
}

module.exports = { validateEnv, getEnv };
