const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/earthonline';

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    });
    console.log('[SYS] Database Core Online: MongoDB Connected');
  } catch (err) {
    console.error('[SYS] MongoDB Connection Error:', err);
    console.log('[SYS] Retrying in 5 seconds...');
    setTimeout(connectDatabase, 5000);
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('[SYS] MongoDB Disconnected. Reconnecting...');
  setTimeout(connectDatabase, 5000);
});

// Initialize connection
connectDatabase();

async function findUserByUsername(username) {
  return await User.findOne({ username });
}

async function findUserByUsernameOrEmail(loginId) {
  return await User.findOne({
    $or: [
      { username: loginId },
      { email: loginId }
    ]
  });
}

async function createUser(userData) {
  const user = new User(userData);
  if (!user.createdAt) user.createdAt = Date.now();
  await user.save();
}

async function getRegionPopulation(homeRegion) {
  return await User.countDocuments({ homeRegion });
}

async function getAllRegionsPopulation() {
  const result = await User.aggregate([
    { $group: { _id: '$homeRegion', count: { $sum: 1 } } }
  ]);
  const pops = {};
  for (const r of result) pops[r._id] = r.count;
  return pops;
}

async function updateUserDiscord(username, discordData) {
  const result = await User.findOneAndUpdate(
    { username },
    { $set: { discord: discordData } },
    { new: true }
  );
  return !!result;
}

async function migrateOfflineTime() {
  try {
    const regionResult = await User.updateMany(
      { homeRegion: { $exists: false } },
      { $set: { homeRegion: 'asia' } }
    );
    
    const countryResult = await User.updateMany(
      { $or: [{ country: { $exists: false } }, { country: 'UNKNOWN' }] },
      { $set: { country: 'TW' } }
    );
    
    await User.updateMany(
      { money: { $exists: false } },
      { $set: { money: 0, incomePerMinute: 1, totalEarned: 0, upgrades: {}, investments: {} } }
    );
    
    await User.updateMany(
      { recoveryKey: { $exists: false } },
      { $set: { recoveryKey: '未產生' } }
    );
    
    const botFilter = {
      'discord.id': { $exists: false },
      $or: [
        { username: { $regex: /^[a-zA-Z0-9]{15,35}$/ } }
      ]
    };
    const botResult = await User.deleteMany(botFilter);
    console.log(`[SYS] Migration complete. Updated regions: ${regionResult.modifiedCount}. Deleted bots: ${botResult.deletedCount}.`);
  } catch (err) {
    console.error('Error during migrateOfflineTime:', err);
  }
}

async function updateUser(username, updates) {
  return await User.updateOne({ username }, updates);
}

async function findUsersWithDiscord() {
  return await User.find({ 'discord.id': { $exists: true, $ne: null } }).lean();
}

module.exports = {
  User,
  findUserByUsername,
  findUserByUsernameOrEmail,
  createUser,
  getRegionPopulation,
  getAllRegionsPopulation,
  updateUserDiscord,
  getGlobalProduction,
  getRegionProduction,
  migrateOfflineTime,
  updateUser,
  incrementUser,
  findUsersWithDiscord
};
