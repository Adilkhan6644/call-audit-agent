require('dotenv').config();
const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./swagger');
const { generalLimiter } = require('./middleware/rateLimit');
const healthRouter = require('./routes/health');
const readinessRouter = require('./routes/readiness');
const authRouter = require('./routes/auth');
const categoriesRouter = require('./routes/categories');
const auditInstructionsRouter = require('./routes/auditInstructions');
const recordingsRouter = require('./routes/recordings');
const auditsRouter = require('./routes/audits');
const usageRouter = require('./routes/usage');
const adminRouter = require('./routes/admin');

const app = express();

app.use(express.json());
// Dev-only CORS: the frontend (client/, served separately by Vite) calls this
// API cross-origin. Hand-rolled instead of the `cors` package — it's one
// header plus an OPTIONS short-circuit, not worth a dependency.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(generalLimiter);
// swagger-ui-express renders relative asset URLs (./swagger-ui.css etc.), so the
// bare path (no trailing slash) must redirect first or those assets resolve to
// the site root and 401 out of an unrelated router's unscoped `authenticate`.
app.use((req, res, next) => {
  // app.get('/docs') would also match '/docs/' (Express's non-strict routing),
  // causing a redirect loop — compare the exact path string instead.
  if (req.path === '/docs') return res.redirect(301, '/docs/');
  next();
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(healthRouter);
app.use(readinessRouter);
app.use(authRouter);
app.use(categoriesRouter);
app.use(auditInstructionsRouter);
app.use(recordingsRouter);
app.use(auditsRouter);
app.use(usageRouter);
app.use(adminRouter);

// Mirrors ai-service's {"error": {code, message}} shape so the frontend
// never has to handle two different error formats.
app.use((req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(422).json({ error: { code: 'validation_error', message: 'File exceeds maximum upload size' } });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: { code: err.code || 'internal_error', message: err.message || 'Internal server error' },
  });
});

module.exports = app;
