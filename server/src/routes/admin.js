const express = require('express');

const authenticate = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const apiKeys = require('../services/apiKeys');
const AdminAlert = require('../models/adminAlert');
const { NotFoundError } = require('../errors');

const router = express.Router();
router.use(authenticate, adminOnly);

/**
 * @openapi
 * /admin/api-keys:
 *   get:
 *     tags: [Admin]
 *     summary: List LLM provider API key status (masked — last4 only, never the full value)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *       403: { description: Not an admin }
 */
router.get('/admin/api-keys', async (req, res) => {
  const entries = await Promise.all(apiKeys.PROVIDERS.map((provider) => apiKeys.getMasked(provider)));
  res.json(entries);
});

/**
 * @openapi
 * /admin/api-keys/{provider}:
 *   put:
 *     tags: [Admin]
 *     summary: Rotate an LLM provider's API key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [openai, gemini, groq] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value: { type: string }
 *     responses:
 *       200: { description: OK (masked body only) }
 *       422: { description: Unknown provider or missing value }
 */
router.put('/admin/api-keys/:provider', async (req, res) => {
  const entry = await apiKeys.rotate(req.params.provider, req.body.value, req.user);
  res.json(entry);
});

/**
 * @openapi
 * /admin/alerts:
 *   get:
 *     tags: [Admin]
 *     summary: List admin alerts (defaults to unresolved only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: resolved
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200: { description: OK }
 */
router.get('/admin/alerts', async (req, res) => {
  const resolved = req.query.resolved === 'true';
  const alerts = await AdminAlert.find({ resolved }).sort({ lastSeenAt: -1 });
  res.json(alerts);
});

/**
 * @openapi
 * /admin/alerts/{id}/resolve:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark an admin alert resolved
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.patch('/admin/alerts/:id/resolve', async (req, res) => {
  const alert = await AdminAlert.findById(req.params.id);
  if (!alert) {
    throw new NotFoundError('Alert not found');
  }
  alert.resolved = true;
  alert.resolvedAt = new Date();
  await alert.save();
  res.json(alert);
});

module.exports = router;
