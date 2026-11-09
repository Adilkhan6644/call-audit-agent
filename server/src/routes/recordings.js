const express = require('express');
const multer = require('multer');

const Recording = require('../models/recording');
const authenticate = require('../middleware/auth');
const storage = require('../services/storage');
const { getOwnRecording, deletePreviousDaysRecordings } = require('../services/recordings');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_UPLOAD_SIZE_BYTES },
});

/**
 * @openapi
 * /recordings:
 *   post:
 *     tags: [Recordings]
 *     summary: Upload an audio recording
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Created }
 *       422: { description: Unsupported type, spoofed content, or too large }
 */
router.post('/recordings', upload.single('file'), async (req, res) => {
  const { key, sizeBytes } = await storage.save(req.file.originalname, req.file.buffer);
  const recording = await Recording.create({
    ownerId: req.user._id,
    originalFilename: req.file.originalname,
    storageKey: key,
    contentType: req.file.mimetype || 'application/octet-stream',
    sizeBytes,
  });
  await deletePreviousDaysRecordings(req.user._id);
  res.status(201).json(recording);
});

/**
 * @openapi
 * /recordings:
 *   get:
 *     tags: [Recordings]
 *     summary: List your own recordings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/recordings', async (req, res) => {
  const recordings = await Recording.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.json(recordings);
});

/**
 * @openapi
 * /recordings/{id}:
 *   get:
 *     tags: [Recordings]
 *     summary: Get a recording's metadata
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found or not owned }
 */
router.get('/recordings/:id', async (req, res) => {
  const recording = await getOwnRecording(req.params.id, req.user);
  res.json(recording);
});

/**
 * @openapi
 * /recordings/{id}/download:
 *   get:
 *     tags: [Recordings]
 *     summary: Download a recording's audio file
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       404: { description: Not found or not owned }
 */
router.get('/recordings/:id/download', async (req, res) => {
  const recording = await getOwnRecording(req.params.id, req.user);
  const content = await storage.download(recording.storageKey);
  res.set('Content-Type', recording.contentType);
  res.set('Content-Disposition', `attachment; filename="${recording.originalFilename}"`);
  res.send(content);
});

module.exports = router;
