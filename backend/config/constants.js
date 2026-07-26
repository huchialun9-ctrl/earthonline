const FILTERED_WORDS = ['fuck', 'shit', 'asshole', 'bitch', 'damn', 'cao', '幹', '靠北', '操你媽', 'fucking', 'stupid', 'idiot', 'nigger', 'bastard', 'piss off', 'suck my', 'motherfucker'];

const COUNTRY_REGION = {
  TW: 'asia', CN: 'asia', JP: 'asia', KR: 'asia', HK: 'asia', SG: 'asia',
  IN: 'asia', MY: 'asia', TH: 'asia', VN: 'asia', PH: 'asia', ID: 'asia',
  US: 'us', CA: 'us', MX: 'us',
  GB: 'eu', DE: 'eu', FR: 'eu', IT: 'eu', ES: 'eu', NL: 'eu', SE: 'eu',
  NO: 'eu', DK: 'eu', FI: 'eu', PL: 'eu', PT: 'eu', BE: 'eu', AT: 'eu',
  CH: 'eu', IE: 'eu', CZ: 'eu', TR: 'eu', IL: 'eu', AE: 'asia', SA: 'asia',
  EG: 'eu', NG: 'eu', KE: 'eu', ZA: 'eu',
  AU: 'other', BR: 'other', RU: 'other', AR: 'other', CL: 'other', NZ: 'other'
};

const REGIONS = ['asia', 'us', 'eu'];

const UPGRADES = [
  { id: 'basic_computer', name: '基礎電腦', baseCost: 100, costMultiplier: 1.5, incomePerLevel: 5 },
  { id: 'server_rack', name: '伺服器機架', baseCost: 500, costMultiplier: 1.8, incomePerLevel: 15 },
  { id: 'ai_assistant', name: 'AI 助手', baseCost: 2000, costMultiplier: 2.0, incomePerLevel: 50 },
  { id: 'data_center', name: '資料中心', baseCost: 10000, costMultiplier: 2.2, incomePerLevel: 200 },
  { id: 'quantum_pc', name: '量子電腦', baseCost: 50000, costMultiplier: 2.5, incomePerLevel: 800 },
];

const INVESTMENT_TYPES = [
  { id: 'deposit', name: '定存', risk: '極低', minAmount: 100, returnPerTick: 0.001, lockMinutes: 0, unlockCost: 0 },
  { id: 'bond', name: '債券', risk: '低', minAmount: 1000, returnPerTick: 0.003, lockMinutes: 30, unlockCost: 0.1 },
  { id: 'index_fund', name: '指數基金', risk: '中', minAmount: 5000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
  { id: 'real_estate', name: '房地產', risk: '中低', minAmount: 50000, returnPerTick: 0.008, lockMinutes: 120, unlockCost: 0.15 },
  { id: 'startup', name: '新創投資', risk: '高', minAmount: 2000, returnPerTick: null, lockMinutes: 0, unlockCost: 0 },
];

module.exports = {
  FILTERED_WORDS,
  COUNTRY_REGION,
  REGIONS,
  UPGRADES,
  INVESTMENT_TYPES
};
