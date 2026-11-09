const UsageRecord = require('../models/usageRecord');

/** Written only here, by the pipeline itself after a successful run — never accepted as client input. */
async function recordUsage(ownerId, auditJobId) {
  await UsageRecord.create({ ownerId, auditJobId });
}

async function getUsageTotal(ownerId, { from, to } = {}) {
  const filter = { ownerId };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  return UsageRecord.countDocuments(filter);
}

module.exports = { recordUsage, getUsageTotal };
