const logger = require('../config/logger');

function errorHandler(err, req, res, _next) {
  const statusCode =
    Number.isInteger(err.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500;

  const response = {
    message: err.message || 'Internal server error',
  };

  if (err.code) {
    response.code = err.code;
  }

  if (err.details && statusCode < 500) {
    response.details = err.details;
  }

  logger.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    code: err.code,
    details: err.details,
    stack: err.stack,
  });

  res.status(statusCode).json(response);
}

module.exports = errorHandler;