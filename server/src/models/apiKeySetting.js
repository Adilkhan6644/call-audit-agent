const mongoose = require('mongoose');

const apiKeySettingSchema = new mongoose.Schema({
  provider: { type: String, enum: ['openai', 'gemini', 'groq'], required: true, unique: true },
  value: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

module.exports = mongoose.model('ApiKeySetting', apiKeySettingSchema);
