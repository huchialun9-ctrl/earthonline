const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  type: { type: String, required: true },
  name: { type: String, required: true },
  reward: { type: Number, required: true },
  duration: { type: Number, required: true },
  requirement: { type: Map, of: Number, default: {} },
  status: { type: String, enum: ['available', 'in_progress', 'completed', 'failed'], default: 'available' },
  startedAt: { type: Number, default: null },
  expiresAt: { type: Number, default: null }
});

contractSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
