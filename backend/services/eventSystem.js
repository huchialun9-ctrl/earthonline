const User = require('../models/User');
const { GLOBAL_EVENT_TYPES } = require('../config/constants');

function getRandomEvent() {
  return GLOBAL_EVENT_TYPES[Math.floor(Math.random() * GLOBAL_EVENT_TYPES.length)];
}

function getEventDuration(type) {
  switch (type) {
    case 'QUANTUM_BURST': return 2 * 60 * 60 * 1000;
    case 'SATELLITE_ALIGNMENT': return 2 * 60 * 60 * 1000;
    case 'SYSTEM_MAINTENANCE': return 30 * 60 * 1000;
    case 'DATA_GOLD_RUSH': return 15 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

function getEventMultiplier(type, connectedUserCount) {
  switch (type) {
    case 'QUANTUM_BURST': return 3.0;
    case 'DATA_GOLD_RUSH': return 5.0;
    case 'SYSTEM_MAINTENANCE': return 0.5;
    case 'SATELLITE_ALIGNMENT': return 1.0 + (connectedUserCount * 0.1);
    default: return 1.0;
  }
}

async function applyEventEndRewards(type, connectedUsers) {
  if (connectedUsers.size === 0) return;

  const usernames = Array.from(connectedUsers.values()).map(u => u.username);
  if (type === 'SOLAR_STORM') {
    await User.updateMany(
      { username: { $in: usernames } },
      { $inc: { accumulatedBonusPoints: 200 } }
    ).catch(console.error);
  } else if (type === 'SYSTEM_MAINTENANCE') {
    await User.updateMany(
      { username: { $in: usernames } },
      { $inc: { accumulatedBonusPoints: 500 } }
    ).catch(console.error);
  }
}

module.exports = {
  getRandomEvent,
  getEventDuration,
  getEventMultiplier,
  applyEventEndRewards
};
