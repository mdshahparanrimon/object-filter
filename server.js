const app = require('./app');
const env = require('./src/config/env');
const logger = require('./src/config/logger');

const server = app.listen(env.port, () => {
  logger.info('Server started', {
    port: env.port,
    baseUrl: env.ghl.baseUrl,
  });
});

let isShuttingDown = false;

function shutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(exitCode);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    message: error.message,
    stack: error.stack,
  });

  shutdown('uncaughtException', 1);
});