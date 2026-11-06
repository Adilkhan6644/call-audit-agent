const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../errors');
const User = require('../models/user');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError());
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new UnauthorizedError());
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return next(new UnauthorizedError());
  }

  req.user = user;
  next();
}

module.exports = authenticate;
