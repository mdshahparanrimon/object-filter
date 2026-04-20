const logger = require('../config/logger');

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  logger.info('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  res.on('finish', () => {
    const durationInNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationInNs) / 1e6;

    logger.info('Request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}

module.exports = requestLogger;