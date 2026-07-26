const User = require('../models/User');
const crypto = require('crypto');

const INVESTMENT_TYPES = [
  { id: 'deposit', name: '定存', risk: '極低', minAmount: 100, returnPerTick: 0.001, lockMinutes: 0, unlockCost: 0 },
  { id: 'bond', name: '債券', risk: '低', minAmount: 1000, returnPerTick: 0.003, lockMinutes: 30, unlockCost: 0.1 },
  { id: 'index_fund', name: '指數基金', risk: '中', minAmount: 5000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
  { id: 'real_estate', name: '房地產', risk: '中低', minAmount: 50000, returnPerTick: 0.008, lockMinutes: 120, unlockCost: 0.15 },
  { id: 'startup', name: '新創投資', risk: '高', minAmount: 2000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
];

async function invest(username, type, amount) {
  const user = await User.findOne({ username });
  if (!user) return { success: false, error: '用戶不存在' };

  const invDef = INVESTMENT_TYPES.find(i => i.id === type);
  if (!invDef) return { success: false, error: '投資類型不存在' };

  if (amount < invDef.minAmount) return { success: false, error: `最低投資金額為 ${invDef.minAmount}` };
  if ((user.money || 0) < amount) return { success: false, error: '金錢不足' };

  user.money -= amount;

  const invId = crypto.randomUUID().slice(0, 8);
  if (!user.investments) user.investments = new Map();
  user.investments.set(invId, {
    type,
    amount,
    startTime: Date.now(),
    lockUntil: invDef.lockMinutes > 0 ? Date.now() + invDef.lockMinutes * 60000 : 0
  });

  await user.save();

  return {
    success: true,
    investmentId: invId,
    type,
    amount,
    money: user.money
  };
}

async function withdrawInvestment(username, invId) {
  const user = await User.findOne({ username });
  if (!user) return { success: false, error: '用戶不存在' };

  const inv = user.investments && user.investments.get(invId);
  if (!inv) return { success: false, error: '投資不存在' };

  const invDef = INVESTMENT_TYPES.find(i => i.id === inv.type);
  const now = Date.now();

  let returned = inv.amount;
  if (invDef.lockMinutes > 0 && now < (inv.lockUntil || 0)) {
    const penalty = invDef.unlockCost || 0;
    returned = Math.floor(inv.amount * (1 - penalty));
  }

  user.money = (user.money || 0) + returned;
  user.investments.delete(invId);
  await user.save();

  return { success: true, returned, money: user.money };
}

async function getInvestmentData(username) {
  const user = await User.findOne({ username });
  if (!user) return null;

  return {
    investments: Object.fromEntries(user.investments || new Map()),
    money: user.money || 0
  };
}

module.exports = { INVESTMENT_TYPES, invest, withdrawInvestment, getInvestmentData };
