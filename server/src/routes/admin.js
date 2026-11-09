const express = require('express');

const authenticate = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const apiKeys = require('../services/apiKeys');

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

module.exports = router;
