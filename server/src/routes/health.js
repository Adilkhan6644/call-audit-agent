const express = require('express');

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Service status check
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', app_name: 'AuditIQ' });
});

module.exports = router;
