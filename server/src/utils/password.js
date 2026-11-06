const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = { hashPassword, verifyPassword };
