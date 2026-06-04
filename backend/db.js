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

// 記錄連接嘗試
console.log('[SYS] 開始連接 MongoDB...');
console.log('[SYS] URI Schema:', MONGODB_URI.substring(0, 30) + '...');

// Connect without deprecated options (handled automatically by modern Mongoose)
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // 增加伺服器選擇超時時間
  socketTimeoutMS: 45000,
  family: 4 // 強制使用 IPv4
})
  .then(() => {
    isConnected = true;
    console.log('[SYS] ✅ Database Core Online: MongoDB Connected Successfully');
  })
  .catch(err => {
    console.error('[SYS] ❌ MongoDB Connection Error:', err.message);
    console.error('[SYS] Error Code:', err.code);
    console.error('[SYS] Error Name:', err.name);
    if (err.reason) console.error('[SYS] Reason:', err.reason);
    isConnected = false;
  });

// 監聽連線狀態變化
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[SYS] ⚠️  MongoDB Disconnected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('[SYS] ❌ MongoDB Error:', err.message);
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[SYS] ✅ MongoDB Reconnected');
});

async function findUserByUsername(username) {
  if (!isConnected) {
    const error = new Error('Database not connected');
    console.error('[SYS] DB Error - findUserByUsername:', error.message);
    throw error;
  }
  try {
    return await User.findOne({ username });
  } catch (err) {
    console.error('[SYS] DB Query Error - findUserByUsername:', err.message);
    throw err;
  }
}

async function createUser(userData) {
  if (!isConnected) {
    const error = new Error('Database not connected');
    console.error('[SYS] DB Error - createUser:', error.message);
    throw error;
  }
  try {
    const user = new User(userData);
    if (!user.createdAt) user.createdAt = Date.now();
    await user.save();
  } catch (err) {
    console.error('[SYS] DB Query Error - createUser:', err.message);
    throw err;
  }
}

async function getTotalPopulation() {
  if (!isConnected) {
    const error = new Error('Database not connected');
    console.error('[SYS] DB Error - getTotalPopulation:', error.message);
    throw error;
  }
  try {
    return await User.countDocuments({});
  } catch (err) {
    console.error('[SYS] DB Query Error - getTotalPopulation:', err.message);
    throw err;
  }
}

async function updateUserDiscord(username, discordData) {
  if (!isConnected) {
    const error = new Error('Database not connected');
    console.error('[SYS] DB Error - updateUserDiscord:', error.message);
    throw error;
  }
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.discord = discordData;
      await user.save();
      return true;
    }
    return false;
  } catch (err) {
    console.error('[SYS] DB Query Error - updateUserDiscord:', err.message);
    throw err;
  }
}

async function getGlobalProduction(now) {
  if (!isConnected) {
    const error = new Error('Database not connected');
    console.error('[SYS] DB Error - getGlobalProduction:', error.message);
    throw error;
  }
  try {
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
  } catch (err) {
    console.error('[SYS] DB Query Error - getGlobalProduction:', err.message);
    throw err;
  }
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
