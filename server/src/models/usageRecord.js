const mongoose = require('mongoose');

const usageRecordSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auditJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditJob', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
