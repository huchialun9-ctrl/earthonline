const Contract = require('../models/Contract');
const User = require('../models/User');
const crypto = require('crypto');

const CONTRACT_TEMPLATES = [
  { id: 'data_labeling', name: '資料標註', reward: 500, duration: 120000, minIncome: 0 },
  { id: 'server_hosting', name: '伺服器託管', reward: 2000, duration: 300000, minIncome: 50 },
  { id: 'software_dev', name: '軟體開發', reward: 10000, duration: 900000, minIncome: 200, requireEngineers: 2 },
  { id: 'system_maintenance', name: '系統維護', reward: 25000, duration: 1800000, minIncome: 500, requireManager: 1 },
  { id: 'emergency_rescue', name: '緊急救援', reward: 100000, duration: 3600000, minIncome: 1000, requireEmployees: 5 },
];

function generateContracts() {
  const now = Date.now();
  return CONTRACT_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    reward: t.reward,
    duration: t.duration,
    requirement: {
      minIncome: t.minIncome,
      requireEngineers: t.requireEngineers || 0,
      requireManager: t.requireManager || 0,
      requireEmployees: t.requireEmployees || 0
    },
    expiresAt: now + 3600000
  }));
}

async function acceptContract(username, templateId) {
  const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return { success: false, error: '合約不存在' };

  const existing = await Contract.findOne({ userId: username, type: templateId, status: { $in: ['available', 'in_progress'] } });
  if (existing) return { success: false, error: '你已經接了這個合約' };

  const user = await User.findOne({ username });
  if (!user) return { success: false, error: '用戶不存在' };

  if ((user.incomePerMinute || 1) < template.minIncome) return { success: false, error: `需要每分鐘收入達到 ${template.minIncome}` };

  const contract = new Contract({
    id: crypto.randomUUID().slice(0, 8),
    userId: username,
    type: templateId,
    name: template.name,
    reward: template.reward,
    duration: template.duration,
    requirement: {
      minIncome: template.minIncome,
      requireEngineers: template.requireEngineers || 0,
      requireManager: template.requireManager || 0,
      requireEmployees: template.requireEmployees || 0
    },
    status: 'in_progress',
    startedAt: Date.now(),
    expiresAt: Date.now() + template.duration
  });
  await contract.save();

  return { success: true, contractId: contract.id, duration: template.duration };
}

async function checkContractCompletion() {
  const now = Date.now();
  const activeContracts = await Contract.find({ status: 'in_progress' });

  for (const contract of activeContracts) {
    if (now >= (contract.expiresAt || 0)) {
      contract.status = 'completed';
      await contract.save();

      const user = await User.findOne({ username: contract.userId });
      if (user) {
        user.money = (user.money || 0) + contract.reward;
        await user.save();
      }
    }
  }
}

async function getUserContracts(username) {
  const contracts = await Contract.find({ userId: username }).sort({ createdAt: -1 }).limit(20);
  return contracts.map(c => ({
    id: c.id,
    type: c.type,
    name: c.name,
    reward: c.reward,
    duration: c.duration,
    status: c.status,
    startedAt: c.startedAt,
    expiresAt: c.expiresAt
  }));
}

module.exports = { CONTRACT_TEMPLATES, generateContracts, acceptContract, checkContractCompletion, getUserContracts };
