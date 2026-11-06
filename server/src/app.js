require('dotenv').config();
const express = require('express');

const healthRouter = require('./routes/health');
const readinessRouter = require('./routes/readiness');
const authRouter = require('./routes/auth');
const categoriesRouter = require('./routes/categories');

const app = express();

app.use(express.json());
app.use(healthRouter);
app.use(readinessRouter);
app.use(authRouter);
app.use(categoriesRouter);

// Mirrors ai-service's {"error": {code, message}} shape so the frontend
// never has to handle two different error formats.
app.use((req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: { code: err.code || 'internal_error', message: err.message || 'Internal server error' },
  });
});

module.exports = app;
