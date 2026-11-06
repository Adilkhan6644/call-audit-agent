const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalFilename: { type: String, required: true },
  storageKey: { type: String, required: true },
  contentType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  status: { type: String, enum: ['uploaded', 'processing', 'processed', 'failed'], default: 'uploaded' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Recording', recordingSchema);
