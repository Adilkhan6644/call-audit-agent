const express = require('express');

const { isConnected } = require('../db/connection');

const router = express.Router();

/**
 * @openapi
 * /readiness:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity check
 *     responses:
 *       200:
 *         description: Ready
 *       503:
 *         description: Not ready (database disconnected)
 */
router.get('/readiness', (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
  res.json({ status: 'ready', db: 'connected' });
});

module.exports = router;
