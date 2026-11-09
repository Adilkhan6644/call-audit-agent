const mongoose = require('mongoose');

const auditJobSchema = new mongoose.Schema({
  recordingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recording', required: true },
  // Pinned to the exact instruction version active at creation time, even if
  // a newer version is created later — audit traceability.
  instructionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditInstruction', required: true },
  // Denormalized from the instruction at creation time so list/filter
  // queries don't need a join.
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

module.exports = mongoose.model('AuditJob', auditJobSchema);
