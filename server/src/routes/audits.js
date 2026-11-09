const express = require('express');

const AuditJob = require('../models/auditJob');
const AuditInstruction = require('../models/auditInstruction');
const authenticate = require('../middleware/auth');
const { AppError, NotFoundError, ConflictError } = require('../errors');
const { getOwnRecording } = require('../services/recordings');
const { getVisibleCategory } = require('../services/categories');
const { runAuditPipeline } = require('../services/auditPipeline');
const { buildAuditJobsCsv } = require('../services/csvExport');
const { buildAuditJobsPdf } = require('../services/pdfExport');
const { auditLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(authenticate);

async function getOwnAuditJob(jobId, currentUser) {
  const job = await AuditJob.findOne({ _id: jobId, ownerId: currentUser._id });
  if (!job) {
    throw new NotFoundError('Audit job not found');
  }
  return job;
}

/**
 * @openapi
 * /audits:
 *   post:
 *     tags: [Audits]
 *     summary: Run an audit on a recording against a category's active instruction
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryId, recordingId]
 *             properties:
 *               categoryId: { type: string }
 *               recordingId: { type: string }
 *     responses:
 *       201: { description: Created (completed or failed — pipeline runs synchronously) }
 *       409: { description: An audit is already running for this recording }
 */
router.post('/audits', auditLimiter, async (req, res) => {
  const { categoryId, recordingId } = req.body;
  if (!categoryId || !recordingId) {
    throw new AppError('categoryId and recordingId are required', 422, 'validation_error');
  }

  const recording = await getOwnRecording(recordingId, req.user);
  await getVisibleCategory(categoryId, req.user);

  const instruction = await AuditInstruction.findOne({ categoryId, ownerId: req.user._id, isActive: true });
  if (!instruction) {
    throw new NotFoundError('No active instruction for this category');
  }

  const runningDuplicate = await AuditJob.findOne({
    recordingId,
    status: { $in: ['pending', 'processing'] },
  });
  if (runningDuplicate) {
    throw new ConflictError('An audit is already running for this recording');
  }

  const job = await AuditJob.create({
    recordingId,
    instructionId: instruction._id,
    categoryId,
    ownerId: req.user._id,
  });

  const completedJob = await runAuditPipeline(job, recording);
  res.status(201).json(completedJob);
});

/**
 * @openapi
 * /audits:
 *   get:
 *     tags: [Audits]
 *     summary: List your own audit jobs, filterable and paginated
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, completed, failed] }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: '-createdAt' }
 *     responses:
 *       200: { description: OK }
 */
router.get('/audits', async (req, res) => {
  const { status, categoryId, sort = '-createdAt' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

  const filter = { ownerId: req.user._id };
  if (status) filter.status = status;
  if (categoryId) filter.categoryId = categoryId;

  const [items, total] = await Promise.all([
    AuditJob.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    AuditJob.countDocuments(filter),
  ]);

  res.json({ items, total, page, pageSize });
});

/**
 * @openapi
 * /audits/export.csv:
 *   get:
 *     tags: [Audits]
 *     summary: Export your own audit jobs as CSV
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK, content: { text/csv: {} } }
 */
router.get('/audits/export.csv', async (req, res) => {
  const jobs = await AuditJob.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="audits.csv"');
  res.send(buildAuditJobsCsv(jobs));
});

/**
 * @openapi
 * /audits/export.pdf:
 *   get:
 *     tags: [Audits]
 *     summary: Export your own audit jobs as PDF
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK, content: { application/pdf: {} } }
 */
router.get('/audits/export.pdf', async (req, res) => {
  const jobs = await AuditJob.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  const pdf = await buildAuditJobsPdf(jobs);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'attachment; filename="audits.pdf"');
  res.send(pdf);
});

/**
 * @openapi
 * /audits/{id}:
 *   get:
 *     tags: [Audits]
 *     summary: Get an audit job and its result
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK (result is null while pending/processing) }
 *       404: { description: Not found or not owned }
 */
router.get('/audits/:id', async (req, res) => {
  const job = await getOwnAuditJob(req.params.id, req.user);
  res.json(job);
});

module.exports = router;
