const express = require('express');

const AuditInstruction = require('../models/auditInstruction');
const authenticate = require('../middleware/auth');
const { NotFoundError } = require('../errors');
const { getVisibleCategory } = require('../services/categories');
const { createNewVersion } = require('../services/auditInstructions');

const router = express.Router();
router.use(authenticate);

router.post('/audit-instructions', async (req, res) => {
  await getVisibleCategory(req.body.categoryId, req.user);
  const instruction = await createNewVersion(req.body.categoryId, req.user._id, req.body.content);
  res.status(201).json(instruction);
});

router.get('/audit-instructions', async (req, res) => {
  await getVisibleCategory(req.query.categoryId, req.user);
  const instructions = await AuditInstruction.find({
    categoryId: req.query.categoryId,
    ownerId: req.user._id,
  }).sort({ version: 1 });
  res.json(instructions);
});

router.get('/audit-instructions/active', async (req, res) => {
  await getVisibleCategory(req.query.categoryId, req.user);
  const instruction = await AuditInstruction.findOne({
    categoryId: req.query.categoryId,
    ownerId: req.user._id,
    isActive: true,
  });
  if (!instruction) {
    throw new NotFoundError('No active instruction for this category');
  }
  res.json(instruction);
});

module.exports = router;
