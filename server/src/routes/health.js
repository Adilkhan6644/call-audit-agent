const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', app_name: 'AuditIQ' });
});

module.exports = router;
