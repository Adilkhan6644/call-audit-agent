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

module.exports = router;
