const express = require('express');
const multer = require('multer');

const Recording = require('../models/recording');
const authenticate = require('../middleware/auth');
const { NotFoundError } = require('../errors');
const storage = require('../services/storage');
const { deletePreviousDaysRecordings } = require('../services/recordings');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storage.MAX_UPLOAD_SIZE_BYTES },
});

async function getOwnRecording(recordingId, currentUser) {
  const recording = await Recording.findOne({ _id: recordingId, ownerId: currentUser._id });
  if (!recording) {
    throw new NotFoundError('Recording not found');
  }
  return recording;
}

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

router.get('/recordings', async (req, res) => {
  const recordings = await Recording.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.json(recordings);
});

router.get('/recordings/:id', async (req, res) => {
  const recording = await getOwnRecording(req.params.id, req.user);
  res.json(recording);
});

router.get('/recordings/:id/download', async (req, res) => {
  const recording = await getOwnRecording(req.params.id, req.user);
  const content = await storage.download(recording.storageKey);
  res.set('Content-Type', recording.contentType);
  res.set('Content-Disposition', `attachment; filename="${recording.originalFilename}"`);
  res.send(content);
});

module.exports = router;
