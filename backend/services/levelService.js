const User = require('../models/User');

const LEVEL_THRESHOLDS = [
  { level: 1,  sec: 0 },
  { level: 2,  sec: 3600 },       // 1 hour
  { level: 3,  sec: 14400 },      // 4 hours
  { level: 4,  sec: 43200 },      // 12 hours
  { level: 5,  sec: 86400 },      // 1 day
  { level: 6,  sec: 259200 },     // 3 days
  { level: 7,  sec: 604800 },     // 7 days
  { level: 8,  sec: 1209600 },    // 14 days
  { level: 9,  sec: 2592000 },    // 30 days
  { level: 10, sec: 5184000 },    // 60 days
];

function calcLevel(accumulatedTimeMs) {
  const sec = Math.floor((accumulatedTimeMs || 0) / 1000);
  let lv = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (sec >= t.sec) lv = t.level;
    else break;
  }
  return lv;
}

function calcLevelProgress(accumulatedTimeMs) {
  const sec = (accumulatedTimeMs || 0) / 1000;
  let prevThreshold = 0, nextThreshold = LEVEL_THRESHOLDS[1].sec;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (sec >= LEVEL_THRESHOLDS[i].sec) {
      prevThreshold = LEVEL_THRESHOLDS[i].sec;
      nextThreshold = LEVEL_THRESHOLDS[i + 1]?.sec || prevThreshold;
    }
  }
  if (prevThreshold === nextThreshold) return { level: LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].level, progress: 1, nextSec: null };
  return {
    level: calcLevel(accumulatedTimeMs),
    progress: (sec - prevThreshold) / (nextThreshold - prevThreshold),
    nextSec: nextThreshold - sec,
  };
}

const LEVEL_BONUSES = {
  2: { ptMultiplier: 1.05 },
  5: { unlock: 'offline_earnings' },
  10: { unlock: 'talent_system' },
};

function getLevelBonus(level) {
  return LEVEL_BONUSES[level] || null;
}

module.exports = { calcLevel, calcLevelProgress, getLevelBonus, LEVEL_THRESHOLDS };
