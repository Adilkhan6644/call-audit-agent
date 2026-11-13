const AuditInstruction = require('../models/auditInstruction');
const { DEFAULT_INSTRUCTIONS } = require('./defaultInstructions');

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

/**
 * Returns the caller's active instruction for this category, auto-publishing
 * the built-in default as v1 the first time a user touches a built-in
 * category with none yet — so a fresh user never hits a dead-end 404 on a
 * category they didn't create. Custom categories still require the owner to
 * write their own instruction; there's no default content to fall back to.
 */
async function getOrSeedActiveInstruction(category, ownerId) {
  const existing = await AuditInstruction.findOne({ categoryId: category._id, ownerId, isActive: true });
  if (existing) return existing;

  const defaultContent = category.isBuiltin && DEFAULT_INSTRUCTIONS[category.name];
  if (!defaultContent) return null;

  return createNewVersion(category._id, ownerId, defaultContent);
}

module.exports = { createNewVersion, getOrSeedActiveInstruction };
