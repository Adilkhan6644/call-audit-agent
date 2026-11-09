const AdminAlert = require('../models/adminAlert');

/**
 * Dedupe by (type, unresolved): bumps the existing open incident instead of
 * inserting a new row on every single failed request. Resolving an alert
 * closes the incident -- a later call then opens a fresh one, since that's a
 * new incident, not a reopening of the old one.
 */
async function raiseProviderQuotaAlert(message) {
  const existing = await AdminAlert.findOne({ type: 'provider_quota_exceeded', resolved: false });
  if (existing) {
    existing.occurrenceCount += 1;
    existing.lastSeenAt = new Date();
    await existing.save();
    return existing;
  }

  return AdminAlert.create({ type: 'provider_quota_exceeded', message });
}

module.exports = { raiseProviderQuotaAlert };
