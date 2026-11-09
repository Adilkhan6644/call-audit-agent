const express = require('express');

const authenticate = require('../middleware/auth');
const { getUsageTotal } = require('../services/usage');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * /usage:
 *   get:
 *     tags: [Usage]
 *     summary: Get your own usage total, optionally over a date range
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: OK }
 */
router.get('/usage', async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : undefined;
  const to = req.query.to ? new Date(req.query.to) : undefined;
  const total = await getUsageTotal(req.user._id, { from, to });
  res.json({ total });
});

module.exports = router;
