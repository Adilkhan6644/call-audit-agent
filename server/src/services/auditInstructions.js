const AuditInstruction = require('../models/auditInstruction');

/** The only write path for instruction content — never mutate an existing version in place. */
async function createNewVersion(categoryId, ownerId, content) {
  const latest = await AuditInstruction.findOne({ categoryId, ownerId }).sort({ version: -1 });

  if (latest && latest.isActive) {
    latest.isActive = false;
    await latest.save();
  }

  return AuditInstruction.create({
    categoryId,
    ownerId,
    version: latest ? latest.version + 1 : 1,
    content,
    isActive: true,
  });
}

module.exports = { createNewVersion };
