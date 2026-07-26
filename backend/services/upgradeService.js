const User = require('../models/User');
const { UPGRADES, getUpgradeCost } = require('./idleService');

async function buyUpgrade(username, upgradeId) {
  const user = await User.findOne({ username });
  if (!user) return { success: false, error: '用戶不存在' };

  const def = UPGRADES.find(u => u.id === upgradeId);
  if (!def) return { success: false, error: '升級不存在' };

  const currentLevel = (user.upgrades && user.upgrades.get(upgradeId)) || 0;
  const cost = getUpgradeCost(upgradeId, currentLevel);
  if (cost === null) return { success: false, error: '升級不存在' };

  if ((user.money || 0) < cost) return { success: false, error: '金錢不足' };

  user.money -= cost;
  if (!user.upgrades) user.upgrades = new Map();
  user.upgrades.set(upgradeId, currentLevel + 1);

  const newIncome = user.upgrades.get(upgradeId) * def.incomePerLevel;
  const incomeBefore = currentLevel * def.incomePerLevel;
  user.incomePerMinute = (user.incomePerMinute || 1) + (newIncome - incomeBefore);

  await user.save();

  return {
    success: true,
    upgradeId,
    level: currentLevel + 1,
    money: user.money,
    incomePerMinute: user.incomePerMinute,
    cost: getUpgradeCost(upgradeId, currentLevel + 1)
  };
}

async function getUpgradeData(username) {
  const user = await User.findOne({ username });
  if (!user) return null;

  return {
    upgrades: Object.fromEntries(user.upgrades || new Map()),
    money: user.money || 0,
    incomePerMinute: user.incomePerMinute || 1
  };
}

module.exports = { buyUpgrade, getUpgradeData };
