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
  process.exit(1);
}

let isConnected = false;

// 記錄連接嘗試
console.log('[SYS] 開始連接 MongoDB...');
console.log('[SYS] URI Schema:', MONGODB_URI.substring(0, 30) + '...');

// Connect without deprecated options (handled automatically by modern Mongoose)
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2
})
  .then(() => {
    isConnected = true;
    console.log('[SYS] ✅ Database Core Online: MongoDB Connected Successfully');
  })
  .catch(err => {
    console.error('[SYS] ❌ MongoDB Connection Error:', err.name);
    console.error('[SYS] Error Code:', err.code);
    isConnected = false;
  });

// 監聽連線狀態變化
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[SYS] ⚠️  MongoDB Disconnected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('[SYS] ❌ MongoDB Error:', err.name);
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[SYS] ✅ MongoDB Reconnected');
});

/**
 * 驗證 username 格式
 * @param {string} username - 要驗證的用戶名
 * @returns {boolean} 是否有效
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 32) return false;
  // 只允許字母、數字、下劃線、連字符
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

/**
 * 驗證 Discord 資料格式
 * @param {object} discordData - Discord 資料
 * @returns {boolean} 是否有效
 */
function validateDiscordData(discordData) {
  if (!discordData || typeof discordData !== 'object') return false;
  if (!discordData.id || typeof discordData.id !== 'string') return false;
  if (!/^\d{17,20}$/.test(discordData.id)) return false;
  if (!discordData.username || typeof discordData.username !== 'string') return false;
  if (discordData.username.length > 32) return false;
  if (discordData.avatar && typeof discordData.avatar !== 'string') return false;
  if (discordData.avatar && !discordData.avatar.startsWith('http')) return false;
  return true;
}

/**
 * 找到用戶名的用戶
 * @param {string} username - 要查詢的用戶名
 * @returns {Promise<Object|null>} 用戶文檔或 null
 */
async function findUserByUsername(username) {
  if (!isConnected) {
    throw new Error('[DB] Database not connected');
  }
  
  // 輸入驗證
  if (!validateUsername(username)) {
    throw new Error('[DB] Invalid username format');
  }
  
  try {
    const user = await User.findOne({ username }).select('-password');
    return user;
  } catch (err) {
    console.error('[SYS] DB Query Error - findUserByUsername:', err.name);
    throw new Error('[DB] Database query failed');
  }
}

/**
 * 創建新用戶
 * @param {object} userData - 用戶資料 (id, username, password)
 * @returns {Promise<void>}
 */
async function createUser(userData) {
  if (!isConnected) {
    throw new Error('[DB] Database not connected');
  }
  
  // 輸入驗證
  if (!userData || typeof userData !== 'object') {
    throw new Error('[DB] Invalid user data format');
  }
  
  if (!validateUsername(userData.username)) {
    throw new Error('[DB] Invalid username format');
  }
  
  if (!userData.password || userData.password.length < 1) {
    throw new Error('[DB] Password is required');
  }
  
  if (!userData.id || typeof userData.id !== 'string') {
    throw new Error('[DB] User ID is required');
  }

  try {
    // 檢查用戶名是否已存在
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
      throw new Error('[DB] Username already exists');
    }

    const user = new User({
      id: userData.id,
      username: userData.username,
      password: userData.password,
      createdAt: Date.now(),
      discord: null
    });
    
    await user.save();
    console.log(`[SYS] New user created: ${userData.username} (ID: ${userData.id})`);
  } catch (err) {
    if (err.message.includes('[DB]')) throw err;
    if (err.code === 11000) {
      throw new Error('[DB] Duplicate entry detected');
    }
    console.error('[SYS] DB Query Error - createUser:', err.name);
    throw new Error('[DB] Failed to create user');
  }
}

/**
 * 取得全球用戶總數
 * @returns {Promise<number>} 用戶總數
 */
async function getTotalPopulation() {
  if (!isConnected) {
    throw new Error('[DB] Database not connected');
  }

  try {
    const count = await User.countDocuments({});
    return Math.max(0, count); // 確保不會是負數
  } catch (err) {
    console.error('[SYS] DB Query Error - getTotalPopulation:', err.name);
    throw new Error('[DB] Failed to get population count');
  }
}

/**
 * 更新用戶的 Discord 資料
 * @param {string} username - 用戶名
 * @param {object} discordData - Discord 資料
 * @returns {Promise<boolean>} 是否更新成功
 */
async function updateUserDiscord(username, discordData) {
  if (!isConnected) {
    throw new Error('[DB] Database not connected');
  }

  // 輸入驗證
  if (!validateUsername(username)) {
    throw new Error('[DB] Invalid username format');
  }

  if (!validateDiscordData(discordData)) {
    throw new Error('[DB] Invalid Discord data format');
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return false;
    }

    // 不允許更改已有的 Discord 資料（防止帳號劫持）
    if (user.discord && user.discord.id !== discordData.id) {
      console.warn(`[SYS] Attempted Discord ID change for user: ${username}`);
      throw new Error('[DB] Cannot change Discord account once set');
    }

    user.discord = discordData;
    await user.save();
    console.log(`[SYS] Discord profile updated for user: ${username} (Discord ID: ${discordData.id})`);
    return true;
  } catch (err) {
    if (err.message.includes('[DB]')) throw err;
    console.error('[SYS] DB Query Error - updateUserDiscord:', err.name);
    throw new Error('[DB] Failed to update Discord profile');
  }
}

/**
 * 計算全球掛機時間
 * @param {number} now - 當前時間戳 (毫秒)
 * @returns {Promise<number>} 全球掛機時間 (秒)
 */
async function getGlobalProduction(now) {
  if (!isConnected) {
    throw new Error('[DB] Database not connected');
  }

  // 輸入驗證
  if (typeof now !== 'number' || now < 0) {
    throw new Error('[DB] Invalid timestamp');
  }

  try {
    const result = await User.aggregate([
      {
        $project: {
          // 防止負數：使用 max 確保不小於 0
          idleSeconds: {
            $max: [
              0,
              {
                $floor: {
                  $divide: [{ $subtract: [now, "$createdAt"] }, 1000]
                }
              }
            ]
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
    
    const total = result.length > 0 ? result[0].totalProduction : 0;
    return Math.max(0, total); // 再次確保非負
  } catch (err) {
    console.error('[SYS] DB Query Error - getGlobalProduction:', err.name);
    throw new Error('[DB] Failed to calculate global production');
  }
}

/**
 * 檢查資料庫是否已連接
 * @returns {boolean} 連接狀態
 */
function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  findUserByUsername,
  createUser,
  getTotalPopulation,
  updateUserDiscord,
  getGlobalProduction,
  isDBConnected,
  // 額外的驗證函數供外部使用
  validateUsername,
  validateDiscordData
};
