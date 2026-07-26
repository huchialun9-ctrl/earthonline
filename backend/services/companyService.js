const Company = require('../models/Company');
const CompanyEmployee = require('../models/CompanyEmployee');
const User = require('../models/User');
const StockHolding = require('../models/StockHolding');
const crypto = require('crypto');

const CREATE_COST = 50000;
const INDUSTRIES = ['tech', 'manufacturing', 'finance', 'service'];
const INDUSTRY_NAMES = { tech: '科技', manufacturing: '製造', finance: '金融', service: '服務' };

async function createCompany(username, name, industry) {
  if (!name || name.length < 1 || name.length > 20) return { success: false, error: '公司名稱需在 1-20 字元' };
  if (!INDUSTRIES.includes(industry)) return { success: false, error: '無效的產業類型' };

  const existing = await Company.findOne({ ownerId: username });
  if (existing) return { success: false, error: '你已經有一間公司了' };

  const user = await User.findOne({ username });
  if (!user || (user.money || 0) < CREATE_COST) return { success: false, error: `金錢不足，需要 ${CREATE_COST}` };

  user.money -= CREATE_COST;
  const companyId = crypto.randomUUID().slice(0, 8);

  const company = new Company({
    id: companyId,
    name,
    ownerId: username,
    industry,
    shares: 1000,
    cash: 0,
    level: 1,
    equipmentLevel: 1,
    brandLevel: 1,
    createdAt: Date.now()
  });
  await company.save();

  user.companyId = companyId;
  await user.save();

  const employee = new CompanyEmployee({
    id: crypto.randomUUID().slice(0, 8),
    companyId,
    userId: username,
    role: 'owner',
    salary: 0,
    satisfaction: 100,
    hiredAt: Date.now()
  });
  await employee.save();

  const holding = new StockHolding({
    userId: username,
    companyId,
    quantity: 1000
  });
  await holding.save();

  return { success: true, companyId };
}

async function getCompanyData(companyId) {
  const company = await Company.findOne({ id: companyId });
  if (!company) return null;

  const employees = await CompanyEmployee.find({ companyId });
  return {
    id: company.id,
    name: company.name,
    ownerId: company.ownerId,
    industry: company.industry,
    industryName: INDUSTRY_NAMES[company.industry] || company.industry,
    shares: company.shares,
    cash: company.cash || 0,
    level: company.level,
    equipmentLevel: company.equipmentLevel,
    brandLevel: company.brandLevel,
    employees: employees.map(e => ({
      userId: e.userId,
      role: e.role,
      salary: e.salary,
      satisfaction: e.satisfaction
    })),
    upgradeCosts: {
      level: Math.floor(50000 * Math.pow(2, company.level - 1)),
      equipment: Math.floor(20000 * Math.pow(1.8, company.equipmentLevel - 1)),
      brand: Math.floor(50000 * Math.pow(1.5, company.brandLevel - 1))
    }
  };
}

async function upgradeCompany(companyId, upgradeType) {
  const company = await Company.findOne({ id: companyId });
  if (!company) return { success: false, error: '公司不存在' };

  const costs = {
    level: Math.floor(50000 * Math.pow(2, company.level - 1)),
    equipment: Math.floor(20000 * Math.pow(1.8, company.equipmentLevel - 1)),
    brand: Math.floor(50000 * Math.pow(1.5, company.brandLevel - 1))
  };

  const cost = costs[upgradeType];
  if (!cost) return { success: false, error: '無效的升級類型' };
  if ((company.cash || 0) < cost) return { success: false, error: '公司資金不足' };

  company.cash -= cost;
  if (upgradeType === 'level') company.level++;
  else if (upgradeType === 'equipment') company.equipmentLevel++;
  else if (upgradeType === 'brand') company.brandLevel++;

  await company.save();

  return { success: true, [upgradeType]: company[upgradeType], cash: company.cash };
}

async function hireEmployee(username, targetUserId, role) {
  const company = await Company.findOne({ ownerId: username });
  if (!company) return { success: false, error: '你沒有公司' };

  const roles = ['intern', 'staff', 'engineer', 'manager', 'expert'];
  if (!roles.includes(role)) return { success: false, error: '無效的職位' };

  const salaries = { intern: 1, staff: 5, engineer: 20, manager: 50, expert: 200 };
  const hireCosts = { intern: 200, staff: 1000, engineer: 5000, manager: 20000, expert: 100000 };

  const existing = await CompanyEmployee.findOne({ companyId: company.id, userId: targetUserId });
  if (existing) return { success: false, error: '該用戶已在你的公司' };

  if ((company.cash || 0) < hireCosts[role]) return { success: false, error: '公司資金不足' };

  company.cash -= hireCosts[role];
  await company.save();

  const emp = new CompanyEmployee({
    id: crypto.randomUUID().slice(0, 8),
    companyId: company.id,
    userId: targetUserId,
    role,
    salary: salaries[role],
    satisfaction: 100,
    hiredAt: Date.now()
  });
  await emp.save();

  return { success: true, employee: { userId: targetUserId, role, salary: salaries[role] } };
}

async function fireEmployee(username, targetUserId) {
  const company = await Company.findOne({ ownerId: username });
  if (!company) return { success: false, error: '你沒有公司' };

  const emp = await CompanyEmployee.findOne({ companyId: company.id, userId: targetUserId });
  if (!emp) return { success: false, error: '找不到該員工' };
  if (emp.role === 'owner') return { success: false, error: '不能開除自己' };

  await CompanyEmployee.deleteOne({ id: emp.id });

  return { success: true };
}

async function setSalary(username, targetUserId, newSalary) {
  const company = await Company.findOne({ ownerId: username });
  if (!company) return { success: false, error: '你沒有公司' };

  const emp = await CompanyEmployee.findOne({ companyId: company.id, userId: targetUserId });
  if (!emp) return { success: false, error: '找不到該員工' };
  if (newSalary < 1) return { success: false, error: '薪資必須大於 0' };

  emp.salary = newSalary;
  emp.satisfaction = Math.min(100, emp.satisfaction + 5);
  await emp.save();

  return { success: true, salary: newSalary, satisfaction: emp.satisfaction };
}

async function getUserCompany(username) {
  const user = await User.findOne({ username });
  if (!user || !user.companyId) return null;
  return getCompanyData(user.companyId);
}

module.exports = { createCompany, getCompanyData, upgradeCompany, hireEmployee, fireEmployee, setSalary, getUserCompany, INDUSTRIES, INDUSTRY_NAMES, CREATE_COST };
