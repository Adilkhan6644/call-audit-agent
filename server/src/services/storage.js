const crypto = require('crypto');
const path = require('path');

const { AppError, NotFoundError } = require('../errors');

const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg']);
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

// Real file bytes, not the extension or client Content-Type, decide the type.
const MAGIC_CHECKS = {
  '.wav': (h) => h.subarray(0, 4).toString('latin1') === 'RIFF' && h.subarray(8, 12).toString('latin1') === 'WAVE',
  '.ogg': (h) => h.subarray(0, 4).toString('latin1') === 'OggS',
  '.mp3': (h) => h.subarray(0, 3).toString('latin1') === 'ID3' || (h.length >= 2 && h[0] === 0xff && (h[1] & 0xe0) === 0xe0),
  '.m4a': (h) => h.subarray(4, 8).toString('latin1') === 'ftyp',
};

function objectUrl(key) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET_NAME}/${key}`;
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    apikey: process.env.SUPABASE_SERVICE_KEY,
    ...extra,
  };
}

async function upload(key, contentType, body) {
  const response = await fetch(objectUrl(key), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': contentType }),
    body,
  });
  if (!response.ok) {
    throw new AppError('Failed to store recording', 502);
  }
}

async function deleteMany(keys) {
  if (keys.length === 0) {
    return;
  }
  const response = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET_NAME}`,
    {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    }
  );
  if (!response.ok) {
    throw new AppError('Failed to delete old recordings', 502);
  }
}

async function download(key) {
  const response = await fetch(objectUrl(key), { headers: authHeaders() });
  if (response.status === 400) {
    const text = await response.text();
    if (text.includes('not_found')) {
      throw new NotFoundError('Recording file no longer exists in storage');
    }
  }
  if (!response.ok) {
    throw new AppError('Failed to retrieve recording', 502);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Validate and upload an audio file to Supabase Storage. Returns { key, sizeBytes }. */
async function save(filename, buffer) {
  const extension = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new AppError(`Unsupported file type: ${extension || 'unknown'}`, 422);
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new AppError('File exceeds maximum upload size', 422);
  }

  if (!MAGIC_CHECKS[extension](buffer)) {
    throw new AppError('File content does not match its extension', 422);
  }

  const key = `${crypto.randomUUID().replace(/-/g, '')}${extension}`;
  const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';
  await upload(key, contentType, buffer);

  return { key, sizeBytes: buffer.length };
}

const CONTENT_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

module.exports = { save, download, deleteMany, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES };
