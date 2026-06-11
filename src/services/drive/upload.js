const { Readable } = require('stream');
const { google } = require('googleapis');
const { getEnv } = require('../../config/env');

let driveClient;

function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const {
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
  } = getEnv();

  const oauth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: googleRefreshToken,
  });

  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return driveClient;
}

async function uploadRecording({ buffer, fileName, folderId }) {
  const drive = getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'audio/mpeg',
      body: Readable.from(buffer),
    },
    supportsAllDrives: true,
    fields: 'id,name,webViewLink',
  });

  return {
    id: response.data.id,
    name: response.data.name,
    webViewLink: response.data.webViewLink,
  };
}

module.exports = { uploadRecording, getDriveClient };
