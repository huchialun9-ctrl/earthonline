const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const discordAuthLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many requests, please try again later.' } });
const geoip = require('geoip-lite');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/auth');
const leaderboardRoutes = require('./routes/leaderboard');
const globalRoutes = require('./routes/global');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const User = require('./models/User');
const Company = require('./models/Company');
const discordBot = require('./discordBot');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const os = require('os');

const { COUNTRY_REGION, REGIONS } = require('./config/constants');
const { JWT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, BACKEND_URL, DISCORD_REDIRECT_URI, DISCORD_WEBHOOK_URL, FRONTEND_URL, ALLOWED_ORIGINS } = require('./config/env');
const { startCleanupInterval } = require('./jobs/cleanup');
const { runStartupMigrations } = require('./jobs/migration');

const { processIdleTick, processCompanyTick, processInvestments } = require('./services/idleService');
const { buyUpgrade, getUpgradeData } = require('./services/upgradeService');
const { invest, withdrawInvestment, getInvestmentData } = require('./services/investmentService');
const { placeOrder, cancelOrder, getMarketData, getOrderBook, getPortfolio, getUserOrders } = require('./services/stockService');
const { createCompany, getCompanyData, upgradeCompany, hireEmployee, fireEmployee, setSalary, getUserCompany } = require('./services/companyService');
const { generateContracts, acceptContract, checkContractCompletion, getUserContracts } = require('./services/contractService');

const { registerChatHandlers } = require('./socket/chatHandler');
const { registerSocialHandlers } = require('./socket/socialHandler');

// Chat rate limiting
const chatCooldowns = new Map();

// Discord role cache: discordId -> { role, ts }
const roleCache = new Map();
const ROLE_CACHE_TTL = 60 * 1000;

async function getCachedRole(discordId) {
  const cached = roleCache.get(discordId);
  if (cached && Date.now() - cached.ts < ROLE_CACHE_TTL) return cached.role;
  const role = await discordBot.getHighestRole(discordId);
  roleCache.set(discordId, { role: role || '', ts: Date.now() });
  return role || '';
}

runStartupMigrations();

function obfuscateIp(ip) {
  if (!ip) return '0.0.0.0';
  const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (ipv4Match) return ipv4Match[1] + '.x.x';
  const ipv6Match = ip.match(/^([0-9a-f:]+:[0-9a-f:]+):/i);
  if (ipv6Match) return ipv6Match[1] + ':xxxx:xxxx';
  return 'x.x.x.x';
}

async function sendDiscordWebhook(message) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error('[SYS] Discord Webhook error:', err);
  }
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'public/downloads')));
app.use(morgan('short'));
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    connectSrc: ["'self'", BACKEND_URL, FRONTEND_URL, 'wss://earthonline.qzz.io:443', 'ws://earthonline.qzz.io:3001', 'wss://earthonline.qzz.io:443', 'ws://earthonline.qzz.io:3001']
  }
}}));

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() }));

app.get('/api/auth/discord', discordAuthLimiter, (req, res) => {
  const state = req.query.state;
  if (!state) return res.status(400).send('Missing state');
  const redirectUri = `${BACKEND_URL}/api/auth/discord/callback`;
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`;
  res.redirect(discordAuthUrl);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const redirectUri = `${BACKEND_URL}/api/auth/discord/callback`;
  if (error || !code || !state) return res.status(400).send(`Discord Authentication Failed. <a href="${FRONTEND_URL}">Return to app</a>`);
  let action = 'bind', decoded = null, returnTo = null;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    action = stateData.action || 'bind';
    returnTo = stateData.returnTo;
    if (returnTo) {
      try {
        const returnUrl = new URL(returnTo);
        const frontendHost = FRONTEND_URL ? new URL(FRONTEND_URL).hostname : null;
        const isDev = process.env.NODE_ENV === 'development' || process.env.BACKEND_URL?.includes('localhost');
        const allowedHosts = [
          'localhost', '127.0.0.1',
          'earthonline-7odc.onrender.com', 'earthonline1.pages.dev',
          'earthonline-2m7.pages.dev', 'earthonline.qzz.io',
        ];
        if (frontendHost && !allowedHosts.includes(frontendHost)) allowedHosts.push(frontendHost);
        if (!allowedHosts.includes(returnUrl.hostname)) returnTo = null;
      } catch { returnTo = null; }
    }
    if (!returnTo) returnTo = action === 'login' ? FRONTEND_URL : '/';
    if (action === 'bind') decoded = jwt.verify(stateData.token, JWT_SECRET);
  } catch (err) { return res.status(401).send('Invalid state payload or expired token.'); }
  try {
    const fetch = (await import('node-fetch')).default;
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri, scope: 'identify' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000)
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.status(400).send('Failed to obtain access token from Discord');
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` }, signal: AbortSignal.timeout(10000)
    });
    const userData = await userRes.json();
    const avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${(BigInt(userData.id) >> 22n) % 6n}.png`;
    const profile = { id: userData.id, username: userData.global_name || userData.username, avatar: avatarUrl };
    if (action === 'login') {
      let user = await User.findOne({ 'discord.id': profile.id });
      if (!user) {
        let baseName = profile.username.replace(/\s+/g, '_'), finalName = baseName, counter = 1;
        while (await db.findUserByUsername(finalName)) finalName = `${baseName}_${counter++}`;
        await db.createUser({ id: 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000), username: finalName, password: 'discord_oauth_' + Math.random().toString(36).slice(2), discord: profile, country: 'UNKNOWN' });
        user = await db.findUserByUsername(finalName);
      }
      const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      return res.redirect(`${returnTo}#token=${token}`);
    } else {
      const success = await db.updateUserDiscord(decoded.username, profile);
      if (success) res.redirect(returnTo);
      else res.status(404).send('User not found in Earth Online database');
    }
  } catch (err) { console.error(err); res.status(500).send('Internal Server Error during Discord OAuth2 callback'); }
});

app.use('/api/:region', authRoutes);
app.use('/api/:region', leaderboardRoutes);
app.use('/api', globalRoutes);
app.use((req, res) => {
  res.redirect(FRONTEND_URL || 'https://earthonline1.pages.dev');
});

app.use((err, req, res, next) => {
  console.error('[SYS] Express Error:', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
});

const crashLogPath = path.join(__dirname, 'crash.log');
async function writeCrashLog(type, err) {
  try {
    const timestamp = new Date().toISOString();
    const stack = err?.stack || err?.message || String(err);
    await fs.promises.appendFile(crashLogPath, `[${timestamp}] [${type}] ${stack}\n`);
  } catch (e) { console.error('[SYS] Failed to write crash log:', e); }
}
process.on('uncaughtException', (err) => { writeCrashLog('UNCAUGHT_EXCEPTION', err); console.error('[SYS] Uncaught Exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { writeCrashLog('UNHANDLED_REJECTION', reason); console.error('[SYS] Unhandled Rejection:', reason); });

let reviveCounts = new Map();
const lastCompTime = new Map();
startCleanupInterval(new Map(), reviveCounts, chatCooldowns, roleCache);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

discordBot.setIoInstance(io);

const { isPaused } = require('./state/tickState');
const regions = REGIONS;

function makeRegionState() {
  return { connectedUsers: new Map(), multiplier: 1.0, activeUsers: 0 };
}
const regionStates = { asia: makeRegionState(), us: makeRegionState(), eu: makeRegionState() };

let hardwareStats = { cpu: 0 };
setInterval(() => {
  try {
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      const cpuUsage = (os.loadavg()[0] / cpus.length) * 100;
      hardwareStats.cpu = Math.min(100, Math.max(0, cpuUsage));
    }
  } catch (err) {
    console.error('[SYS] Hardware stat error:', err);
  }
}, 5000);

process.on('SIGTERM', () => { console.log('[SYS] SIGTERM received, shutting down...'); process.exit(0); });
process.on('SIGINT', () => { console.log('[SYS] SIGINT received, shutting down...'); process.exit(0); });

let idleTickCounter = 0;

regions.forEach(regionName => {
  const nsp = io.of(`/${regionName}`);
  const state = regionStates[regionName];

  const tickInterval = setInterval(async () => {
    if (isPaused()) return;

    state.activeUsers = state.connectedUsers.size;

    idleTickCounter++;
    try {
      await processIdleTick(state.connectedUsers);
    } catch (err) {
      console.error('[SYS] Idle tick error:', err);
    }

    if (idleTickCounter % 12 === 0) {
      try {
        await processCompanyTick();
      } catch (err) {
        console.error('[SYS] Company tick error:', err);
      }
      try {
        await checkContractCompletion();
      } catch (err) {
        console.error('[SYS] Contract check error:', err);
      }
    }

    if (idleTickCounter % 60 === 0) {
      try {
        await processInvestments();
      } catch (err) {
        console.error('[SYS] Investment tick error:', err);
      }
    }

    try {
      let comp = '1.000';
      if (state.activeUsers > 1000000) comp = '0.001';
      else if (state.activeUsers > 100000) comp = '0.010';
      else if (state.activeUsers > 10000) comp = '0.100';
      const allPops = await db.getAllRegionsPopulation().catch(() => ({}));
      const globalPop = Object.values(allPops).reduce((a, b) => a + b, 0);
      nsp.emit('global_stats', {
        activeUsers: state.activeUsers,
        totalPopulation: globalPop,
        multiplier: state.multiplier,
        systemHardware: { cpu: hardwareStats.cpu }
      });
    } catch (err) {
      console.error('[SYS] Stats emission error:', err);
    }
  }, 5000);

  nsp.on('connection', (socket) => {
    const connectedUsers = state.connectedUsers;
    const nspIo = nsp;

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('sync_user', async () => {
      if (!socket.user) return;
      const dbUser = await db.findUserByUsername(socket.user.username);
      if (dbUser) {
        socket.emit('user_state_update', {
          money: dbUser.money || 0,
          incomePerMinute: dbUser.incomePerMinute || 1
        });
        if (connectedUsers.has(socket.id)) {
          const cu = connectedUsers.get(socket.id);
          cu.money = dbUser.money || 0;
          cu.incomePerMinute = dbUser.incomePerMinute || 1;
        }
      }
    });

    socket.on('authenticate', async (data) => {
      try {
        const decoded = jwt.verify(data.token, JWT_SECRET);
        let ip = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
        if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        const dbUser = await db.findUserByUsername(decoded.username);

        if (dbUser?.discord?.id) {
          const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
          if (adminIds.includes(dbUser.discord.id)) {
            await User.updateOne({ username: decoded.username }, { $set: { role: 'admin' } });
            if (dbUser) dbUser.role = 'admin';
          } else {
            try {
              const discordRole = await discordBot.getHighestRole(dbUser.discord.id);
              if (discordRole) {
                if (discordRole.includes('地球管理團隊')) {
                  await User.updateOne({ username: decoded.username }, { $set: { role: 'admin' } });
                  if (dbUser) dbUser.role = 'admin';
                } else if (dbUser?.role === 'admin' && !discordRole.includes('地球管理團隊')) {
                  await User.updateOne({ username: decoded.username }, { $set: { role: 'user' } });
                  if (dbUser) dbUser.role = 'user';
                }
              }
            } catch (err) {
              console.error('[SYS] Discord role sync error:', err);
            }
          }
        }

        if (process.env.NODE_ENV === 'development') {
          const devAdmins = (process.env.DEV_ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
          if (devAdmins.includes(decoded.username)) {
            await User.updateOne({ username: decoded.username }, { $set: { role: 'admin' } });
            if (dbUser) dbUser.role = 'admin';
          }
        }

        if (dbUser && dbUser.bannedUntil && dbUser.bannedUntil > Date.now()) {
          const remainMin = Math.ceil((dbUser.bannedUntil - Date.now()) / 60000);
          socket.emit('auth_error', { message: `此帳號已被封鎖，剩餘 ${remainMin} 分鐘後解除。` });
          return;
        }

        let userCountry = dbUser?.initialCountry || dbUser?.country || 'TW';
        let userLat, userLon;
        if (dbUser?.initialLat != null && dbUser?.initialLon != null) {
          userLat = dbUser.initialLat;
          userLon = dbUser.initialLon;
        } else {
          let geo = geoip.lookup(ip);
          if (!geo || !geo.ll || geo.ll.length < 2) {
            if (ip.includes('127.0.0.1') || ip.includes('::1') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
              geo = { country: 'TW', ll: [23.6978, 120.9605] };
            } else {
              geo = { country: 'TW', ll: [23.6978, 120.9605] };
            }
          }
          userLat = geo.ll[0] + (Math.random() - 0.5) * 0.1;
          userLon = geo.ll[1] + (Math.random() - 0.5) * 0.1;
          userCountry = geo.country;
          await User.updateOne({ username: decoded.username }, {
            $set: { initialLat: userLat, initialLon: userLon, initialCountry: userCountry, country: userCountry }
          });
        }
        if (dbUser) {
          await User.updateOne({ username: decoded.username }, { $set: { country: userCountry } });
        }

        const user = {
          socketId: socket.id,
          id: decoded.id,
          username: decoded.username,
          role: dbUser?.role || 'user',
          discordProfile: dbUser?.discord?.id ? dbUser.discord : null,
          ip: ip,
          ipObfuscated: obfuscateIp(ip),
          country: userCountry,
          lat: userLat,
          lon: userLon,
          money: dbUser?.money || 0,
          incomePerMinute: dbUser?.incomePerMinute || 1,
          createdAt: dbUser?.createdAt || Date.now(),
          connectedAt: Date.now()
        };
        socket.user = user;

        const existingUser = await User.findOne({ username: decoded.username }, 'activeSession');
        if (existingUser && existingUser.activeSession && existingUser.activeSession !== socket.id) {
          const oldSocketId = existingUser.activeSession;
          const oldSocket = nsp.sockets.get(oldSocketId);
          if (oldSocket && oldSocket.connected) {
            oldSocket.emit('auth_error', { message: '您的帳號已在其他裝置登入，此連線已中斷。' });
            setTimeout(() => { try { oldSocket.disconnect(true); } catch(e) { console.error('[SYS] Error disconnecting old socket:', e); } }, 500);
          }
          connectedUsers.delete(oldSocketId);
          await User.updateOne({ username: decoded.username }, { $set: { activeSession: null } });
        }

        for (const [sid, u] of connectedUsers.entries()) {
          if (u.username === decoded.username && sid !== socket.id) {
            connectedUsers.delete(sid);
          }
        }

        await User.updateOne({ username: decoded.username }, { $set: { activeSession: socket.id } });

        connectedUsers.set(socket.id, user);

        const allPopsForInit = await db.getAllRegionsPopulation().catch(() => ({}));
        const globalPopForInit = Object.values(allPopsForInit).reduce((a, b) => a + b, 0);

        socket.emit('init_data', {
          userId: user.id,
          username: user.username,
          role: user.role,
          discordProfile: user.discordProfile,
          ip: user.ipObfuscated,
          country: user.country,
          lat: user.lat,
          lon: user.lon,
          money: user.money,
          incomePerMinute: user.incomePerMinute,
          createdAt: user.createdAt,
          connectedAt: user.connectedAt,
          activeUsers: connectedUsers.size,
          totalPopulation: globalPopForInit
        });

        if (isPaused()) {
          socket.emit('tick_paused');
        }

        const countryRegion = COUNTRY_REGION;
        const buildNodeData = (u) => ({
          id: u.id,
          username: u.username,
          lat: u.lat,
          lon: u.lon,
          country: u.country,
          region: countryRegion[u.country] || 'other'
        });
        nspIo.emit('node_connected', buildNodeData(user));
        const allNodes = Array.from(connectedUsers.values()).map(buildNodeData);
        socket.emit('all_nodes', allNodes);
      } catch (err) {
        console.error('[SYS] Auth error details:', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
          socket.emit('auth_error', { message: '認證失敗或過期' });
        } else {
          socket.emit('terminal_response', '[SYS] 伺服器載入中，請稍後重試。');
          socket.disconnect(true);
        }
      }
    });

    registerChatHandlers(socket, nspIo, state, connectedUsers, chatCooldowns);
    registerSocialHandlers(socket, nspIo, connectedUsers);

    // === Upgrade System ===
    socket.on('get_upgrade_data', async () => {
      if (!socket.user) return;
      const data = await getUpgradeData(socket.user.username);
      if (data) socket.emit('upgrade_data', data);
    });

    socket.on('buy_upgrade', async (upgradeId) => {
      if (!socket.user) return;
      const result = await buyUpgrade(socket.user.username, upgradeId);
      socket.emit('upgrade_result', result);
      if (result.success && connectedUsers.has(socket.id)) {
        connectedUsers.get(socket.id).money = result.money;
        connectedUsers.get(socket.id).incomePerMinute = result.incomePerMinute;
        socket.emit('user_state_update', { money: result.money, incomePerMinute: result.incomePerMinute });
      }
    });

    // === Investment System ===
    socket.on('invest', async (data) => {
      if (!socket.user) return;
      const result = await invest(socket.user.username, data.type, data.amount);
      socket.emit('invest_result', result);
      if (result.success && connectedUsers.has(socket.id)) {
        connectedUsers.get(socket.id).money = result.money;
        socket.emit('user_state_update', { money: result.money });
      }
    });

    socket.on('withdraw_investment', async (invId) => {
      if (!socket.user) return;
      const result = await withdrawInvestment(socket.user.username, invId);
      socket.emit('invest_result', result);
      if (result.success && connectedUsers.has(socket.id)) {
        connectedUsers.get(socket.id).money = result.money;
        socket.emit('user_state_update', { money: result.money });
      }
    });

    socket.on('get_investment_data', async () => {
      if (!socket.user) return;
      const data = await getInvestmentData(socket.user.username);
      if (data) socket.emit('investment_data', data);
    });

    // === Stock Market ===
    socket.on('place_order', async (data) => {
      if (!socket.user) return;
      const result = await placeOrder(data.companyId, socket.user.username, data.type, data.price, data.quantity);
      socket.emit('order_result', result);
      const portfolio = await getPortfolio(socket.user.username);
      socket.emit('portfolio', portfolio);
      const market = await getMarketData();
      socket.emit('market_data', market);
    });

    socket.on('cancel_order', async (orderId) => {
      if (!socket.user) return;
      const result = await cancelOrder(orderId, socket.user.username);
      socket.emit('cancel_order_result', result);
    });

    socket.on('get_market_data', async () => {
      if (!socket.user) return;
      const market = await getMarketData();
      socket.emit('market_data', market);
    });

    socket.on('get_order_book', async (companyId) => {
      if (!socket.user) return;
      const book = await getOrderBook(companyId);
      socket.emit('order_book', book);
    });

    socket.on('get_portfolio', async () => {
      if (!socket.user) return;
      const portfolio = await getPortfolio(socket.user.username);
      socket.emit('portfolio', portfolio);
    });

    socket.on('get_my_orders', async () => {
      if (!socket.user) return;
      const orders = await getUserOrders(socket.user.username);
      socket.emit('my_orders', orders);
    });

    // === Company System ===
    socket.on('create_company', async (data) => {
      if (!socket.user) return;
      const result = await createCompany(socket.user.username, data.name, data.industry);
      socket.emit('company_result', result);
      if (result.success) {
        socket.emit('user_state_update', { money: (await User.findOne({ username: socket.user.username })).money });
      }
    });

    socket.on('get_my_company', async () => {
      if (!socket.user) return;
      const data = await getUserCompany(socket.user.username);
      if (data) socket.emit('company_data', data);
      else socket.emit('company_data', null);
    });

    socket.on('upgrade_company', async (upgradeType) => {
      if (!socket.user) return;
      const company = await Company.findOne({ ownerId: socket.user.username });
      if (!company) return;
      const result = await upgradeCompany(company.id, upgradeType);
      socket.emit('company_upgrade_result', result);
      if (result.success) {
        const updated = await getCompanyData(company.id);
        if (updated) socket.emit('company_data', updated);
      }
    });

    socket.on('hire_employee', async (data) => {
      if (!socket.user) return;
      const result = await hireEmployee(socket.user.username, data.targetUserId, data.role);
      socket.emit('hire_result', result);
      if (result.success) {
        const company = await Company.findOne({ ownerId: socket.user.username });
        if (company) {
          const updated = await getCompanyData(company.id);
          if (updated) socket.emit('company_data', updated);
        }
      }
    });

    socket.on('fire_employee', async (targetUserId) => {
      if (!socket.user) return;
      const result = await fireEmployee(socket.user.username, targetUserId);
      socket.emit('fire_result', result);
      if (result.success) {
        const company = await Company.findOne({ ownerId: socket.user.username });
        if (company) {
          const updated = await getCompanyData(company.id);
          if (updated) socket.emit('company_data', updated);
        }
      }
    });

    socket.on('set_salary', async (data) => {
      if (!socket.user) return;
      const result = await setSalary(socket.user.username, data.targetUserId, data.salary);
      socket.emit('salary_result', result);
      if (result.success) {
        const company = await Company.findOne({ ownerId: socket.user.username });
        if (company) {
          const updated = await getCompanyData(company.id);
          if (updated) socket.emit('company_data', updated);
        }
      }
    });

    // === Contract System ===
    socket.on('get_contracts', async () => {
      if (!socket.user) return;
      const templates = generateContracts();
      const active = await getUserContracts(socket.user.username);
      socket.emit('contracts_data', { templates, active });
    });

    socket.on('accept_contract', async (templateId) => {
      if (!socket.user) return;
      const result = await acceptContract(socket.user.username, templateId);
      socket.emit('contract_result', result);
      if (result.success) {
        const active = await getUserContracts(socket.user.username);
        socket.emit('contracts_data', { templates: generateContracts(), active });
      }
    });

    // === Market Info ===
    socket.on('get_market_info', async () => {
      if (!socket.user) return;
      const market = await getMarketData();
      const portfolio = await getPortfolio(socket.user.username);
      socket.emit('market_info', { market, portfolio });
    });

    socket.on('switch_region', async ({ newRegion }) => {
      if (!socket.user || !newRegion || !['asia','us','eu'].includes(newRegion)) return;
      if (newRegion === regionName) { socket.emit('region_switched', { success: false, message: '已在該區域' }); return; }
      try {
        await User.updateOne({ username: socket.user.username }, { $set: { homeRegion: newRegion } });
        socket.emit('region_switched', { success: true, newRegion, message: `已切換至 ${newRegion.toUpperCase()}，重新連線中...` });
      } catch (err) {
        socket.emit('region_switched', { success: false, message: '切換失敗' });
      }
    });

    socket.on('disconnect', async () => {
      const disconnectedUser = connectedUsers.get(socket.id);
      if (disconnectedUser) {
        connectedUsers.delete(socket.id);
        console.log(`[SYS] Node Disconnected: ${socket.id}`);
        nspIo.emit('node_disconnected', { id: disconnectedUser.id || socket.id });
      }
    });
  });
});

async function syncAllOfflineRoles() {
  try {
    const users = await User.find({ 'discord.id': { $exists: true } }, 'username discord role').lean();
    let synced = 0;
    for (const u of users) {
      try {
        const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
        let newRole = 'user';
        if (adminIds.includes(u.discord?.id)) {
          newRole = 'admin';
        } else {
          const discordRole = await discordBot.getHighestRole(u.discord?.id);
          if (discordRole?.includes('地球管理團隊')) newRole = 'admin';
        }
        if (newRole !== 'admin' && process.env.NODE_ENV === 'development') {
          const devAdmins = (process.env.DEV_ADMIN_USERNAMES || '').split(',').map(s => s.trim()).filter(Boolean);
          if (devAdmins.includes(u.username)) newRole = 'admin';
        }
        if (newRole !== (u.role || 'user')) {
          await User.updateOne({ _id: u._id }, { $set: { role: newRole } });
          synced++;
        }
      } catch (err) { /* skip individual errors */ }
    }
    if (synced > 0) console.log(`[SYS] Role sync: updated ${synced} offline users`);
  } catch (err) {
    console.error('[SYS] Role sync error:', err);
  }
}
setTimeout(syncAllOfflineRoles, 15000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SYS] Earth Online v3 Backend initialized on port ${PORT}`);
});
