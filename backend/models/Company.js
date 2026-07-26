const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  industry: { type: String, enum: ['tech', 'manufacturing', 'finance', 'service'], default: 'tech' },
  shares: { type: Number, default: 1000 },
  cash: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  equipmentLevel: { type: Number, default: 1 },
  brandLevel: { type: Number, default: 1 },
  createdAt: { type: Number, default: Date.now },
  lastProfitTick: { type: Number, default: Date.now }
});

companySchema.index({ ownerId: 1 });

module.exports = mongoose.model('Company', companySchema);
