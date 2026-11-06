const express = require('express');

const { isConnected } = require('../db/connection');

const router = express.Router();

router.get('/readiness', (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
  res.json({ status: 'ready', db: 'connected' });
});

module.exports = router;
