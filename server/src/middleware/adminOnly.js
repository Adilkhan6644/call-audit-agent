const { ForbiddenError } = require('../errors');

/** Must run after `authenticate` — never trusts a client-supplied role, only req.user.role from the DB. */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError());
  }
  next();
}

module.exports = adminOnly;
