const mongoose = require('mongoose');

const adminAlertSchema = new mongoose.Schema({
  type: { type: String, enum: ['provider_quota_exceeded'], required: true },
  message: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  occurrenceCount: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
});

module.exports = mongoose.model('AdminAlert', adminAlertSchema);
