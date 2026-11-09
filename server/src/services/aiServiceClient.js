const { AppError } = require('../errors');
const apiKeys = require('./apiKeys');

// ai-service owns the only retry policy (ai_client_wrapper.py) — this client
// does not retry, it only bounds how long a stuck request can hang.
const REQUEST_TIMEOUT_MS = 120000;

function baseUrl() {
  return process.env.AI_SERVICE_URL || 'http://localhost:8001/api/v1';
}

async function callInternal(path, { body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '', ...headers },
      body,
      signal: controller.signal,
    });
  } catch {
    throw new AppError('AI service is unreachable', 502, 'ai_service_error');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AppError('AI service returned an error', 502, 'ai_service_error');
  }
  return response.json();
}

/** Returns the ai-service TranscriptResult shape: { text, language, duration_seconds, segments }. */
async function transcribe(buffer, filename, contentType) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), filename);
  return callInternal('/internal/transcribe', { body: form });
}

/** Returns the ai-service AuditResultSchema shape: { summary, score, findings }. */
async function audit(transcript, instructions) {
  const activeProvider = process.env.LLM_PROVIDER;
  const apiKeyOverride = apiKeys.PROVIDERS.includes(activeProvider) ? await apiKeys.getRaw(activeProvider) : null;

  return callInternal('/internal/audit', {
    body: JSON.stringify({ transcript, instructions, api_key_override: apiKeyOverride || undefined }),
    headers: { 'Content-Type': 'application/json' },
  });
}

module.exports = { transcribe, audit };
