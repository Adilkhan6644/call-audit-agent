const express = require('express');

const AuditInstruction = require('../models/auditInstruction');
const authenticate = require('../middleware/auth');
const { NotFoundError } = require('../errors');
const { getVisibleCategory } = require('../services/categories');
const { createNewVersion } = require('../services/auditInstructions');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * /audit-instructions:
 *   post:
 *     tags: [Audit Instructions]
 *     summary: Add a new instruction version for a category
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, content]
 *             properties:
 *               categoryId: { type: string }
 *               content: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/audit-instructions', async (req, res) => {
  await getVisibleCategory(req.body.categoryId, req.user);
  const instruction = await createNewVersion(req.body.categoryId, req.user._id, req.body.content);
  res.status(201).json(instruction);
});

/**
 * @openapi
 * /audit-instructions:
 *   get:
 *     tags: [Audit Instructions]
 *     summary: List all instruction versions for a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get('/audit-instructions', async (req, res) => {
  await getVisibleCategory(req.query.categoryId, req.user);
  const instructions = await AuditInstruction.find({
    categoryId: req.query.categoryId,
    ownerId: req.user._id,
  }).sort({ version: 1 });
  res.json(instructions);
});

/**
 * @openapi
 * /audit-instructions/active:
 *   get:
 *     tags: [Audit Instructions]
 *     summary: Get the currently active instruction version for a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: No active instruction for this category }
 */
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
