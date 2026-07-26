const UPGRADES = [
  { id: 'basic_computer', name: '基礎電腦', baseCost: 100, costMultiplier: 1.5, incomePerLevel: 5 },
  { id: 'server_rack', name: '伺服器機架', baseCost: 500, costMultiplier: 1.8, incomePerLevel: 15 },
  { id: 'ai_assistant', name: 'AI 助手', baseCost: 2000, costMultiplier: 2.0, incomePerLevel: 50 },
  { id: 'data_center', name: '資料中心', baseCost: 10000, costMultiplier: 2.2, incomePerLevel: 200 },
  { id: 'quantum_pc', name: '量子電腦', baseCost: 50000, costMultiplier: 2.5, incomePerLevel: 800 },
];

const INVEST_TYPES = [
  { id: 'deposit', name: '定存', minAmount: 100, returnPerTick: 0.001, lockMinutes: 0, unlockCost: 0 },
  { id: 'bond', name: '債券', minAmount: 1000, returnPerTick: 0.003, lockMinutes: 30, unlockCost: 0.1 },
  { id: 'index_fund', name: '指數基金', minAmount: 5000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
  { id: 'real_estate', name: '房地產', minAmount: 50000, returnPerTick: 0.008, lockMinutes: 120, unlockCost: 0.15 },
  { id: 'startup', name: '新創投資', minAmount: 2000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
];

function getUpgradeCost(id, level) {
  const def = UPGRADES.find(u => u.id === id);
  if (!def) return null;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
}

function getUpgradeIncome(id, level) {
  const def = UPGRADES.find(u => u.id === id);
  if (!def) return 0;
  return def.incomePerLevel * level;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

module.exports = { UPGRADES, INVEST_TYPES, getUpgradeCost, getUpgradeIncome, generateId };
