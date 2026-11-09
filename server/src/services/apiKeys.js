const ApiKeySetting = require('../models/apiKeySetting');
const { AppError } = require('../errors');

const PROVIDERS = ['openai', 'gemini', 'groq'];

function maskEntry(doc, provider) {
  if (!doc) {
    return { provider, configured: false, last4: null, updatedAt: null };
  }
  return { provider, configured: true, last4: doc.value.slice(-4), updatedAt: doc.updatedAt };
}

/** Only ever returns last4 + metadata — full key value never leaves this function. */
async function getMasked(provider) {
  const doc = await ApiKeySetting.findOne({ provider });
  return maskEntry(doc, provider);
}

/** Internal use only — the full key value. Never import this from a route file. */
async function getRaw(provider) {
  const doc = await ApiKeySetting.findOne({ provider });
  return doc ? doc.value : null;
}

async function rotate(provider, value, adminUser) {
  if (!PROVIDERS.includes(provider)) {
    throw new AppError(`Unknown provider: ${provider}`, 422, 'validation_error');
  }
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new AppError('value is required', 422, 'validation_error');
  }

  const doc = await ApiKeySetting.findOneAndUpdate(
    { provider },
    { value: value.trim(), updatedAt: new Date(), updatedBy: adminUser._id },
    { upsert: true, new: true }
  );
  return maskEntry(doc, provider);
}

module.exports = { PROVIDERS, getMasked, getRaw, rotate };
