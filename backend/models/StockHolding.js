const mongoose = require('mongoose');

const stockHoldingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  companyId: { type: String, required: true },
  quantity: { type: Number, default: 0 }
});

stockHoldingSchema.index({ userId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('StockHolding', stockHoldingSchema);
