const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_EXPIRES_IN = '60m';
const REFRESH_EXPIRES_IN = '7d';
const REFRESH_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

function createAccessToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

function createRefreshToken(userId) {
  // jti keeps two refresh tokens for the same user issued within the same second from
  // being byte-identical, which would collide on the unique tokenHash index.
  return jwt.sign(
    { sub: String(userId), type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.type !== 'access') {
    throw new Error('Not an access token');
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return payload;
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  REFRESH_EXPIRES_SECONDS,
};
