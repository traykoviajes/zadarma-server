const crypto = require('crypto');
const { getEnv } = require('../../config/env');
const { encodeSignature } = require('./signature');

const API_BASE = 'https://api.zadarma.com';
const RECORD_REQUEST_PATH = '/v1/pbx/record/request/';
const RECORD_DELETE_PATH = '/v1/pbx/record/request/';
const DELETE_METHOD = 'DELETE';

function httpBuildQuery(params) {
  const keys = Object.keys(params).sort();
  return keys
    .map((key) => {
      const encodedKey = encodeURIComponent(key).replace(/%20/g, '+');
      const encodedValue = encodeURIComponent(String(params[key])).replace(/%20/g, '+');
      return `${encodedKey}=${encodedValue}`;
    })
    .join('&');
}

async function apiRequest(methodPath, params = {}, httpMethod = 'GET') {
  const { zadarmaApiKey, zadarmaApiSecret } = getEnv();
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  );
  const queryString = httpBuildQuery(filtered);
  const signString = `${methodPath}${queryString}${crypto.createHash('md5').update(queryString).digest('hex')}`;
  const signature = encodeSignature(signString, zadarmaApiSecret);

  const isDelete = httpMethod.toUpperCase() === DELETE_METHOD;
  const url = isDelete || !queryString
    ? `${API_BASE}${methodPath}`
    : `${API_BASE}${methodPath}?${queryString}`;

  const headers = {
    Authorization: `${zadarmaApiKey}:${signature}`,
  };
  if (isDelete && queryString) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, {
    method: httpMethod,
    headers,
    body: isDelete && queryString ? queryString : undefined,
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    const rateHeaders = {
      limit: response.headers.get('x-ratelimit-limit'),
      remaining: response.headers.get('x-ratelimit-remaining'),
      reset: response.headers.get('x-ratelimit-reset'),
    };
    console.error(
      `[zadarma] ${httpMethod} ${methodPath} -> HTTP ${response.status} message="${data.message}" rate=${JSON.stringify(rateHeaders)}`
    );
    throw new Error(data.message || `Zadarma API error: HTTP ${response.status}`);
  }

  return data;
}

async function getRecordDownloadLink({ callId, pbxCallId }) {
  const data = await apiRequest(RECORD_REQUEST_PATH, {
    call_id: callId,
    pbx_call_id: pbxCallId,
  });

  if (data.link) {
    return data.link;
  }

  if (Array.isArray(data.links) && data.links.length > 0) {
    return data.links[0];
  }

  throw new Error('Zadarma API no devolvió enlace de descarga');
}

async function deleteRecord({ callId, pbxCallId }) {
  await apiRequest(
    RECORD_DELETE_PATH,
    {
      call_id: callId,
      pbx_call_id: pbxCallId,
    },
    DELETE_METHOD,
  );
}

module.exports = { getRecordDownloadLink, deleteRecord, httpBuildQuery };
