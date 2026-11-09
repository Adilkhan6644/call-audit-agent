const crypto = require('crypto');

const RefreshToken = require('../models/refreshToken');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  REFRESH_EXPIRES_SECONDS,
} = require('../utils/jwt');
const { UnauthorizedError } = require('../errors');

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issue(userId) {
  const refreshToken = createRefreshToken(userId);
  await RefreshToken.create({
    user: userId,
    tokenHash: hash(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000),
  });
  return refreshToken;
}

/** Verifies, revokes the used token, and issues a fresh pair (rotation). */
async function rotate(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError();
  }

  const record = await RefreshToken.findOne({ tokenHash: hash(refreshToken) });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError();
  }

  record.revokedAt = new Date();
  await record.save();

  const accessToken = createAccessToken(payload.sub);
  const newRefreshToken = await issue(payload.sub);
  return { accessToken, refreshToken: newRefreshToken };
}

async function revoke(refreshToken) {
  await RefreshToken.updateOne({ tokenHash: hash(refreshToken) }, { revokedAt: new Date() });
}

module.exports = { issue, rotate, revoke };
