const { getTalentData, assignTalent, resetTalents, checkTalentPointEarn } = require('../services/talentService');

function registerTalentHandlers(socket, connectedUsers) {
  socket.on('get_talent_data', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const data = await getTalentData(user.username);
    socket.emit('talent_data', data);
  });

  socket.on('assign_talent', async ({ talentId }) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const result = await assignTalent(user.username, talentId);
    socket.emit('talent_result', result);
    const data = await getTalentData(user.username);
    socket.emit('talent_data', data);
  });

  socket.on('reset_talents', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;
    const result = await resetTalents(user.username);
    socket.emit('talent_result', result);
    const data = await getTalentData(user.username);
    socket.emit('talent_data', data);
  });
}

module.exports = { registerTalentHandlers };
