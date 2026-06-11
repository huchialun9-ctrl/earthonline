const { getQuestData, checkQuestReset, claimQuestReward, claimAllBonus, QUESTS } = require('../services/questService');

function registerQuestHandlers(socket, connectedUsers) {
  socket.on('get_quests', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    await checkQuestReset(user.username);
    const quests = await getQuestData(user.username);
    socket.emit('quest_data', { quests, questDefs: QUESTS });
  });

  socket.on('claim_quest', async ({ questId }) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const result = await claimQuestReward(user.username, questId);
    socket.emit('quest_result', result);
    const quests = await getQuestData(user.username);
    socket.emit('quest_data', { quests, questDefs: QUESTS });
  });

  socket.on('claim_all_bonus', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const result = await claimAllBonus(user.username);
    socket.emit('quest_result', result);
    const quests = await getQuestData(user.username);
    socket.emit('quest_data', { quests, questDefs: QUESTS });
  });
}

module.exports = { registerQuestHandlers };
