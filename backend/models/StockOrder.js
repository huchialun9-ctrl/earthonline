const mongoose = require('mongoose');

const stockOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true },
  userId: { type: String, required: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  filled: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'partial', 'filled', 'cancelled'], default: 'open' },
  createdAt: { type: Number, default: Date.now }
});

stockOrderSchema.index({ companyId: 1, status: 1, price: -1 });

module.exports = mongoose.model('StockOrder', stockOrderSchema);
