const { getEnv } = require('../../config/env');
const { getRecordDownloadLink, deleteRecord } = require('./apiClient');
const { getDriveClient, uploadRecording } = require('../drive/upload');
const {
  ensureDatePath,
  findFileInFolder,
  datePathParts,
} = require('../drive/folders');

const MAX_DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30000;
const TIMEZONE = 'America/Bogota';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeNamePart(value) {
  return String(value || 'unknown').replace(/[^\w.-]/g, '_').slice(0, 64);
}

function directionLabel(direction) {
  if (direction === 'in') return 'in';
  if (direction === 'out') return 'out';
  return '';
}

function extractCallInfo(body) {
  const pbxCallId = body.pbx_call_id || body.pbxCallId;
  const callIdWithRec = body.call_id_with_rec || body.callIdWithRec;

  let callStart;
  if (body.call_start) {
    const numeric = Number(body.call_start);
    if (Number.isFinite(numeric) && numeric > 0) {
      callStart = new Date(
        numeric < 1e12 ? numeric * 1000 : numeric
      );
    }
  }
  if (!callStart || Number.isNaN(callStart.getTime())) {
    callStart = new Date();
  }

  return {
    pbxCallId,
    callIdWithRec,
    caller: body.caller_id || body.caller || 'unknown',
    callee: body.callee_id || body.callee || 'unknown',
    direction: directionLabel(body.direction),
    callStart,
  };
}

function formatDateInTimezone(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    ymd: `${get('year')}${get('month')}${get('day')}`,
    hms: `${get('hour')}${get('minute')}${get('second')}`,
  };
}

function buildFileName({ callStart, direction, caller, callee, pbxCallId }) {
  const { ymd, hms } = formatDateInTimezone(callStart);
  const dirLabel = direction ? `${direction}_` : '';
  const fromTo = `${safeNamePart(caller)}_to_${safeNamePart(callee)}`;

  return `${ymd}-${hms}_${dirLabel}${fromTo}_${safeNamePart(pbxCallId)}.mp3`;
}

async function downloadRecording(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al descargar grabación: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchLinkAndDownload({ callIdWithRec, pbxCallId }) {
  const link = await getRecordDownloadLink({
    callId: callIdWithRec,
    pbxCallId,
  });
  return downloadRecording(link);
}

async function processRecording(body) {
  const { recordDownloadDelayMs, googleDriveFolderId } = getEnv();
  const info = extractCallInfo(body);
  const { pbxCallId, callIdWithRec, callStart } = info;

  if (!callIdWithRec && !pbxCallId) {
    throw new Error('NOTIFY_RECORD sin identificadores de llamada');
  }

  const fileName = buildFileName(info);
  const [year, month, day] = datePathParts(callStart);
  const targetPath = `${year}/${month}/${day}/${fileName}`;

  console.log(
    `[recording] Procesando pbx_call_id=${pbxCallId} call_id_with_rec=${callIdWithRec} destino=Drive/${targetPath}, espera ${recordDownloadDelayMs}ms`
  );

  await sleep(recordDownloadDelayMs);

  const drive = getDriveClient();
  const folderId = await ensureDatePath(callStart, googleDriveFolderId, drive);

  const existing = await findFileInFolder(fileName, folderId, drive);
  if (existing) {
    console.log(
      `[recording] Ya existe en Drive, saltando id=${existing.id} name=${existing.name} pbx_call_id=${pbxCallId}`
    );
    return existing;
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const buffer = await fetchLinkAndDownload({ callIdWithRec, pbxCallId });
      const driveFile = await uploadRecording({
        buffer,
        fileName,
        folderId,
      });

      console.log(
        `[recording] Subido a Drive: id=${driveFile.id} name=${driveFile.name} webViewLink=${driveFile.webViewLink} pbx_call_id=${pbxCallId}`
      );

      try {
        await deleteRecord({ callId: callIdWithRec, pbxCallId });
        console.log(`[recording] Eliminado de Zadarma pbx_call_id=${pbxCallId}`);
      } catch (deleteError) {
        console.warn(
          `[recording] No se pudo borrar la grabación de Zadarma pbx_call_id=${pbxCallId}:`,
          deleteError.message
        );
      }

      return driveFile;
    } catch (error) {
      lastError = error;
      console.error(
        `[recording] Intento ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} fallido pbx_call_id=${pbxCallId}:`,
        error.message
      );

      if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

module.exports = { processRecording, buildFileName, extractCallInfo };
