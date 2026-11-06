const jwt = require('jsonwebtoken');

const EXPIRES_IN = '60m';

function createAccessToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.type !== 'access') {
    throw new Error('Not an access token');
  }
  return payload;
}

module.exports = { createAccessToken, verifyAccessToken };
