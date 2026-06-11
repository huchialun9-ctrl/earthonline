const { getAchievementData } = require('../services/achievementService');

const connectedMap = new Map();

function registerAchievementHandlers(socket, connectedUsers) {
  connectedMap.set(socket.id, { socket, connectedUsers });

  socket.on('get_achievements', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const data = await getAchievementData(user.username);
    socket.emit('achievement_data', data);
  });

  socket.on('disconnect', () => {
    connectedMap.delete(socket.id);
  });
}

async function notifyAchievementUpdate(username) {
  for (const [_, entry] of connectedMap) {
    const user = entry.connectedUsers.get(entry.socket.id);
    if (user?.username === username) {
      const data = await getAchievementData(username);
      entry.socket.emit('achievement_data', data);
      break;
    }
  }
}

module.exports = { registerAchievementHandlers, notifyAchievementUpdate };
