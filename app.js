const express = require('express');

const apiRoutes = require('./src/routes');
const requestLogger = require('./src/middleware/requestLogger');
const errorHandler = require('./src/middleware/errorHandler');
const requiredHeaders = require('./src/middleware/requiredHeaders');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', requiredHeaders, apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.use(errorHandler);

module.exports = app;