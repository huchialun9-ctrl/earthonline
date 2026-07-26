const User = require('../models/User');
const Company = require('../models/Company');
const CompanyEmployee = require('../models/CompanyEmployee');

const UPGRADES = [
  { id: 'basic_computer', name: '基礎電腦', baseCost: 100, costMultiplier: 1.5, incomePerLevel: 5 },
  { id: 'server_rack', name: '伺服器機架', baseCost: 500, costMultiplier: 1.8, incomePerLevel: 15 },
  { id: 'ai_assistant', name: 'AI 助手', baseCost: 2000, costMultiplier: 2.0, incomePerLevel: 50 },
  { id: 'data_center', name: '資料中心', baseCost: 10000, costMultiplier: 2.2, incomePerLevel: 200 },
  { id: 'quantum_pc', name: '量子電腦', baseCost: 50000, costMultiplier: 2.5, incomePerLevel: 800 },
];

const EMPLOYEE_BASE_OUTPUT = {
  intern: 3,
  staff: 20,
  engineer: 100,
  manager: 300,
  expert: 1000
};

const EMPLOYEE_HIRE_COST = {
  intern: 200,
  staff: 1000,
  engineer: 5000,
  manager: 20000,
  expert: 100000
};

function getUpgradeCost(upgradeId, level) {
  const def = UPGRADES.find(u => u.id === upgradeId);
  if (!def) return null;
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, level));
}

function getUpgradeIncome(upgradeId, level) {
  const def = UPGRADES.find(u => u.id === upgradeId);
  if (!def) return 0;
  return def.incomePerLevel * level;
}

function getTotalUpgradeIncome(upgrades) {
  let total = 0;
  for (const [id, level] of upgrades) {
    total += getUpgradeIncome(id, level);
  }
  return total;
}

function getEmployeeOutput(role) {
  return EMPLOYEE_BASE_OUTPUT[role] || 0;
}

function getEmployeeHireCost(role) {
  return EMPLOYEE_HIRE_COST[role] || 0;
}

async function processIdleTick(connectedUsers) {
  const now = Date.now();
  const onlineUsernames = Array.from(connectedUsers.keys());

  if (onlineUsernames.length === 0) return;

  const users = await User.find({ username: { $in: onlineUsernames } });

  for (const user of users) {
    let income = user.incomePerMinute || 1;

    for (const [id, level] of user.upgrades || new Map()) {
      income += getUpgradeIncome(id, level);
    }

    const employees = await CompanyEmployee.find({ userId: user.username });
    for (const emp of employees) {
      const output = getEmployeeOutput(emp.role);
      income += output * (emp.satisfaction / 100);
    }

    if (user.companyId) {
      const company = await Company.findOne({ id: user.companyId });
      if (company) {
        const industryBonus = { tech: 1.2, manufacturing: 1.1, finance: 1.15, service: 1.0 };
        const eqMultiplier = 1 + (company.equipmentLevel - 1) * 0.1;
        const brandMultiplier = 1 + (company.brandLevel - 1) * 0.05;
        const levelMultiplier = 1 + (company.level - 1) * 0.2;
        income *= industryBonus[company.industry] || 1;
        income *= eqMultiplier * brandMultiplier * levelMultiplier;
      }
    }

    for (const [invId, inv] of user.investments || new Map()) {
      if (inv.type === 'deposit') income += inv.amount * 0.001;
      else if (inv.type === 'bond') income += inv.amount * 0.003;
      else if (inv.type === 'index_fund') income += inv.amount * (0.005 + Math.random() * 0.01);
    }

    const tickIncome = income / 12;

    user.money = (user.money || 0) + tickIncome;
    user.totalEarned = (user.totalEarned || 0) + tickIncome;
  }

  const bulkOps = users.map(user => ({
    updateOne: {
      filter: { username: user.username },
      update: {
        $set: { money: user.money, totalEarned: user.totalEarned }
      }
    }
  }));

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }
}

async function processCompanyTick() {
  const companies = await Company.find({});
  const now = Date.now();

  for (const company of companies) {
    const rent = 10 + (company.level - 1) * 5;
    const maintenance = 5 + (company.equipmentLevel - 1) * 2;
    const utilities = 3;
    const salaryCost = company.cash > 0 ? 0 : 0;

    const employees = await CompanyEmployee.find({ companyId: company.id });
    let totalSalary = 0;
    for (const emp of employees) {
      totalSalary += emp.salary;
    }

    const industryBonus = { tech: 1.2, manufacturing: 1.1, finance: 1.15, service: 1.0 };
    const eqMultiplier = 1 + (company.equipmentLevel - 1) * 0.1;
    const brandMultiplier = 1 + (company.brandLevel - 1) * 0.05;
    const levelMultiplier = 1 + (company.level - 1) * 0.2;

    let employeeOutput = 0;
    for (const emp of employees) {
      employeeOutput += getEmployeeOutput(emp.role) * (emp.satisfaction / 100);
    }

    const revenue = 100 * (industryBonus[company.industry] || 1) * eqMultiplier * brandMultiplier * levelMultiplier
      + employeeOutput * 0.5;

    const costs = rent + maintenance + utilities + totalSalary;

    const profit = revenue - costs;
    const tickProfit = profit / 12;

    company.cash = (company.cash || 0) + tickProfit;
  }

  if (companies.length > 0) {
    const ops = companies.map(c => ({
      updateOne: {
        filter: { id: c.id },
        update: { $set: { cash: c.cash } }
      }
    }));
    await Company.bulkWrite(ops);
  }
}

async function processInvestments() {
  const investors = await User.find({ 'investments': { $ne: null, $not: { $size: 0 } } });

  for (const user of investors) {
    for (const [invId, inv] of user.investments || new Map()) {
      if (inv.type === 'startup') {
        const r = Math.random();
        if (r < 0.01) {
          user.investments.delete(invId);
        } else if (r < 0.05) {
          user.money += inv.amount * (1 + Math.random() * 3);
          user.investments.delete(invId);
        }
      }
    }
  }
}

module.exports = {
  UPGRADES,
  EMPLOYEE_BASE_OUTPUT,
  EMPLOYEE_HIRE_COST,
  getUpgradeCost,
  getUpgradeIncome,
  getTotalUpgradeIncome,
  getEmployeeOutput,
  getEmployeeHireCost,
  processIdleTick,
  processCompanyTick,
  processInvestments
};
