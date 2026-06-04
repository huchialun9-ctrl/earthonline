const mongoose = require('mongoose');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;

// 檢查 MONGODB_URI 是否已設置
if (!MONGODB_URI) {
  console.error('[SYS] FATAL: MONGODB_URI 環境變數未設置');
  process.exit(1);
}

// 驗證 MongoDB URI 格式
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  console.error('[SYS] FATAL: MONGODB_URI 必須以 mongodb:// 或 mongodb+srv:// 開頭');
  console.error('[SYS] 當前值:', MONGODB_URI);
  process.exit(1);
}

let isConnected = false;

// Connect without deprecated options (handled automatically by modern Mongoose)
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // 增加伺服器選擇超時時間
  socketTimeoutMS: 45000,
  family: 4 // 強制使用 IPv4
})
  .then(() => {
    isConnected = true;
    console.log('[SYS] Database Core Online: MongoDB Connected Successfully');
  })
  .catch(err => {
    console.error('[SYS] MongoDB Connection Error:', err.message);
    console.error('[SYS] Full error:', err);
    isConnected = false;
  });

// 監聽連線狀態變化
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[SYS] MongoDB Disconnected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('[SYS] MongoDB Error:', err.message);
});

async function findUserByUsername(username) {
  if (!isConnected) throw new Error('Database not connected');
  return await User.findOne({ username });
}

async function createUser(userData) {
  if (!isConnected) throw new Error('Database not connected');
  const user = new User(userData);
  if (!user.createdAt) user.createdAt = Date.now();
  await user.save();
}

async function getTotalPopulation() {
  if (!isConnected) throw new Error('Database not connected');
  return await User.countDocuments({});
}

async function updateUserDiscord(username, discordData) {
  if (!isConnected) throw new Error('Database not connected');
  const user = await User.findOne({ username });
  if (user) {
    user.discord = discordData;
    await user.save();
    return true;
  }
  return false;
}

async function getGlobalProduction(now) {
  if (!isConnected) throw new Error('Database not connected');
  const result = await User.aggregate([
    {
      $project: {
        idleSeconds: {
          $floor: {
            $divide: [{ $subtract: [now, "$createdAt"] }, 1000]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalProduction: { $sum: "$idleSeconds" }
      }
    }
  ]);
  return result.length > 0 ? result[0].totalProduction : 0;
}

function isDBConnected() {
  return isConnected;
}

module.exports = {
  findUserByUsername,
  createUser,
  getTotalPopulation,
  updateUserDiscord,
  getGlobalProduction,
  isDBConnected
};
