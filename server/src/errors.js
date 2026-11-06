class AppError extends Error {
  constructor(message, statusCode = 400, code = 'app_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Could not validate credentials') {
    super(message, 401, 'unauthorized');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'conflict');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Not allowed') {
    super(message, 403, 'forbidden');
  }
}

module.exports = { AppError, UnauthorizedError, ConflictError, NotFoundError, ForbiddenError };
