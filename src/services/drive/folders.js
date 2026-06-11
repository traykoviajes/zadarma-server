// Navegación de carpetas en Drive: buscar / crear / asegurar path por fecha.

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function escapeQueryString(value) {
  return String(value).replace(/'/g, "\\'");
}

async function findFolder(name, parentId, drive) {
  const safeName = escapeQueryString(name);
  const safeParent = escapeQueryString(parentId);

  const response = await drive.files.list({
    q: `name='${safeName}' and mimeType='${FOLDER_MIME}' and '${safeParent}' in parents and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files[0] || null;
}

async function createFolder(name, parentId, drive) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return response.data;
}

async function findOrCreateFolder(name, parentId, drive) {
  const existing = await findFolder(name, parentId, drive);
  if (existing) {
    return existing;
  }
  return createFolder(name, parentId, drive);
}

function datePathParts(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day];
}

async function ensureDatePath(date, rootFolderId, drive) {
  const parts = datePathParts(date);
  let currentId = rootFolderId;

  for (const part of parts) {
    const folder = await findOrCreateFolder(part, currentId, drive);
    currentId = folder.id;
  }

  return currentId;
}

async function findFileInFolder(fileName, folderId, drive) {
  const safeName = escapeQueryString(fileName);
  const safeFolder = escapeQueryString(folderId);

  const response = await drive.files.list({
    q: `name='${safeName}' and '${safeFolder}' in parents and trashed=false`,
    fields: 'files(id,name,webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files[0] || null;
}

module.exports = {
  findFolder,
  createFolder,
  findOrCreateFolder,
  ensureDatePath,
  findFileInFolder,
  datePathParts,
};
