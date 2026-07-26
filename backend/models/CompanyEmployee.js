const mongoose = require('mongoose');

const companyEmployeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true },
  userId: { type: String, required: true },
  role: { type: String, enum: ['owner', 'manager', 'employee'], default: 'employee' },
  salary: { type: Number, default: 1 },
  satisfaction: { type: Number, default: 100 },
  hiredAt: { type: Number, default: Date.now }
});

companyEmployeeSchema.index({ companyId: 1 });
companyEmployeeSchema.index({ userId: 1 });

module.exports = mongoose.model('CompanyEmployee', companyEmployeeSchema);
