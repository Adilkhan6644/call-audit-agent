const mongoose = require('mongoose');

const auditInstructionSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true },
  content: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

auditInstructionSchema.index({ categoryId: 1, ownerId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('AuditInstruction', auditInstructionSchema);
