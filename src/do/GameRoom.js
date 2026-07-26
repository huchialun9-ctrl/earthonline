import { DurableObject } from 'cloudflare:workers';
import { UPGRADES, INVEST_TYPES, getUpgradeCost, getUpgradeIncome, generateId } from './utils';

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();
    this.companies = new Map();
    this.employees = new Map();
    this.orders = [];
    this.holdings = new Map();
    this.contracts = new Map();
    this.wsSessions = new Map();

    ctx.blockConcurrencyWhile(async () => {
      const sql = this.ctx.storage.sql;
      sql.exec(`CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY, money REAL DEFAULT 0, income_per_minute REAL DEFAULT 1,
        total_earned REAL DEFAULT 0, upgrades TEXT DEFAULT '{}', investments TEXT DEFAULT '{}',
        company_id TEXT, country TEXT DEFAULT 'TW'
      )`);
      sql.exec(`CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL,
        industry TEXT DEFAULT 'tech', shares INTEGER DEFAULT 1000, cash REAL DEFAULT 0,
        level INTEGER DEFAULT 1, equip_level INTEGER DEFAULT 1, brand_level INTEGER DEFAULT 1
      )`);
      sql.exec(`CREATE TABLE IF NOT EXISTS employees (
        cid TEXT, username TEXT, role TEXT DEFAULT 'employee', salary REAL DEFAULT 1,
        satisfaction REAL DEFAULT 100, PRIMARY KEY (cid, username)
      )`);
      sql.exec(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, cid TEXT, username TEXT, type TEXT, price REAL,
        qty INTEGER, filled INTEGER DEFAULT 0, status TEXT DEFAULT 'open'
      )`);
      sql.exec(`CREATE TABLE IF NOT EXISTS holdings (
        cid TEXT, username TEXT, qty INTEGER DEFAULT 0, PRIMARY KEY (cid, username)
      )`);

      this.ctx.storage.setAlarm(Date.now() + 5000);
    });
  }

  async alarm() {
    const now = Date.now();
    const tickIncome = 5000;

    for (const [username, p] of this.players) {
      let income = p.incomePerMinute || 1;
      const upgrades = safeParse(p.upgrades, {});
      for (const [id, lvl] of Object.entries(upgrades)) {
        income += getUpgradeIncome(id, lvl);
      }

      const myCompany = this.companies.get(p.company_id || '');
      if (myCompany) {
        const industryBonus = { tech: 1.2, manufacturing: 1.1, finance: 1.15, service: 1.0 };
        income *= (industryBonus[myCompany.industry] || 1)
          * (1 + (myCompany.equip_level - 1) * 0.1)
          * (1 + (myCompany.brand_level - 1) * 0.05)
          * (1 + (myCompany.level - 1) * 0.2);
      }

      const investments = safeParse(p.investments, {});
      for (const inv of Object.values(investments)) {
        if (inv.type === 'deposit') income += inv.amount * 0.001;
        else if (inv.type === 'bond') income += inv.amount * 0.003;
        else if (inv.type === 'index_fund') income += inv.amount * (0.005 + Math.random() * 0.01);
        else if (inv.type === 'real_estate') income += inv.amount * 0.008;
      }

      const gain = income / 12;
      p.money = (p.money || 0) + gain;
      p.total_earned = (p.total_earned || 0) + gain;
    }

    for (const [cid, c] of this.companies) {
      const rent = 10 + (c.level - 1) * 5;
      const maintenance = 5 + (c.equip_level - 1) * 2;
      const industryBonus = { tech: 1.2, manufacturing: 1.1, finance: 1.15, service: 1.0 };
      const revenue = 100 * (industryBonus[c.industry] || 1)
        * (1 + (c.equip_level - 1) * 0.1)
        * (1 + (c.brand_level - 1) * 0.05)
        * (1 + (c.level - 1) * 0.2);
      const costs = rent + maintenance;
      c.cash = (c.cash || 0) + (revenue - costs) / 12;
    }

    this.matchOrders();
    this.checkContracts();

    for (const ws of this.wsSessions.values()) {
      try {
        ws.send(JSON.stringify({
          event: 'tick',
          money: this.players.get(ws.username)?.money || 0,
          incomePerMinute: this.players.get(ws.username)?.incomePerMinute || 1
        }));
      } catch (e) { /* ignore */ }
    }

    this.ctx.storage.setAlarm(now + tickIncome);
  }

  matchOrders() {
    const active = this.orders.filter(o => o.status === 'open' || o.status === 'partial');
    const buys = active.filter(o => o.type === 'buy').sort((a, b) => b.price - a.price || a.createdAt - b.createdAt);
    const sells = active.filter(o => o.type === 'sell').sort((a, b) => a.price - b.price || a.createdAt - b.createdAt);

    for (const buy of buys) {
      const bRem = buy.qty - buy.filled;
      if (bRem <= 0) continue;
      for (const sell of sells) {
        const sRem = sell.qty - sell.filled;
        if (sRem <= 0 || sell.price > buy.price) continue;
        const trade = Math.min(bRem, sRem);
        const price = Math.round((buy.price + sell.price) / 2);
        buy.filled += trade; sell.filled += trade;
        buy.status = buy.filled >= buy.qty ? 'filled' : 'partial';
        sell.status = sell.filled >= sell.qty ? 'filled' : 'partial';

        this.addHolding(buy.username, sell.cid, trade);
        this.addHolding(sell.username, sell.cid, -trade);

        const buyer = this.players.get(buy.username);
        const seller = this.players.get(sell.username);
        if (buyer) buyer.money = (buyer.money || 0) - trade * price - Math.ceil(trade * price * 0.01);
        if (seller) seller.money = (seller.money || 0) + trade * price - Math.ceil(trade * price * 0.01);
      }
    }
  }

  addHolding(username, cid, qty) {
    const key = `${username}:${cid}`;
    const existing = this.holdings.get(key);
    const newQty = (existing || 0) + qty;
    if (newQty <= 0) this.holdings.delete(key);
    else this.holdings.set(key, newQty);
  }

  checkContracts() {
    const now = Date.now();
    for (const [id, c] of this.contracts) {
      if (c.status === 'in_progress' && now >= (c.expires_at || Infinity)) {
        c.status = 'completed';
        const player = this.players.get(c.username);
        if (player) player.money = (player.money || 0) + c.reward;
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.wsSessions.set(server, server);

      server.addEventListener('message', async (msg) => {
        try {
          const data = JSON.parse(msg.data);
          await this.handleMessage(server, data);
        } catch (e) {
          server.send(JSON.stringify({ event: 'error', message: 'Invalid message' }));
        }
      });

      server.addEventListener('close', () => {
        this.wsSessions.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  async handleMessage(ws, data) {
    const { event, payload } = data;

    if (event === 'auth') {
      ws.username = payload.username;
      const p = this.players.get(ws.username);
      if (!p) {
        this.players.set(ws.username, { username: ws.username, money: 0, incomePerMinute: 1, totalEarned: 0, upgrades: '{}', investments: '{}', company_id: null, country: payload.country || 'TW' });
      }
      ws.send(JSON.stringify({
        event: 'init_data',
        username: ws.username,
        money: this.players.get(ws.username)?.money || 0,
        incomePerMinute: this.players.get(ws.username)?.incomePerMinute || 1
      }));
      return;
    }

    if (!ws.username) {
      ws.send(JSON.stringify({ event: 'error', message: 'Not authenticated' }));
      return;
    }

    const p = this.players.get(ws.username);
    if (!p) return;

    switch (event) {
      case 'sync':
        ws.send(JSON.stringify({ event: 'user_state', money: p.money, incomePerMinute: p.incomePerMinute }));
        break;

      case 'buy_upgrade': {
        const def = UPGRADES.find(u => u.id === payload);
        if (!def) { ws.send(JSON.stringify({ event: 'upgrade_result', success: false, error: '不存在' })); return; }
        const upgrades = safeParse(p.upgrades, {});
        const level = upgrades[payload] || 0;
        const cost = getUpgradeCost(payload, level);
        if (cost === null || (p.money || 0) < cost) {
          ws.send(JSON.stringify({ event: 'upgrade_result', success: false, error: '金錢不足' })); return;
        }
        p.money -= cost;
        upgrades[payload] = level + 1;
        p.upgrades = JSON.stringify(upgrades);
        p.incomePerMinute = 1 + Object.entries(upgrades).reduce((sum, [id, lvl]) => sum + getUpgradeIncome(id, lvl), 0);
        ws.send(JSON.stringify({ event: 'upgrade_result', success: true, upgradeId: payload, level: level + 1, money: p.money, incomePerMinute: p.incomePerMinute }));
        break;
      }

      case 'get_upgrade_data':
        ws.send(JSON.stringify({ event: 'upgrade_data', upgrades: safeParse(p.upgrades, {}), money: p.money, incomePerMinute: p.incomePerMinute }));
        break;

      case 'invest': {
        const invDef = INVEST_TYPES.find(i => i.id === payload.type);
        if (!invDef || (p.money || 0) < payload.amount) {
          ws.send(JSON.stringify({ event: 'invest_result', success: false, error: '金錢不足' })); return;
        }
        p.money -= payload.amount;
        const investments = safeParse(p.investments, {});
        const invId = generateId();
        investments[invId] = { type: payload.type, amount: payload.amount, startTime: Date.now(), lockUntil: invDef.lockMinutes > 0 ? Date.now() + invDef.lockMinutes * 60000 : 0 };
        p.investments = JSON.stringify(investments);
        ws.send(JSON.stringify({ event: 'invest_result', success: true, investmentId: invId, money: p.money }));
        break;
      }

      case 'withdraw_investment': {
        const investments = safeParse(p.investments, {});
        const inv = investments[payload];
        if (!inv) { ws.send(JSON.stringify({ event: 'invest_result', success: false, error: '不存在' })); return; }
        const invDef = INVEST_TYPES.find(i => i.id === inv.type);
        let returned = inv.amount;
        if (invDef && invDef.lockMinutes > 0 && inv.lockUntil > Date.now()) {
          returned = Math.floor(inv.amount * (1 - (invDef.unlockCost || 0)));
        }
        p.money = (p.money || 0) + returned;
        delete investments[payload];
        p.investments = JSON.stringify(investments);
        ws.send(JSON.stringify({ event: 'invest_result', success: true, returned, money: p.money }));
        break;
      }

      case 'get_investment_data':
        ws.send(JSON.stringify({ event: 'investment_data', investments: safeParse(p.investments, {}), money: p.money }));
        break;

      case 'create_company': {
        if (p.company_id) { ws.send(JSON.stringify({ event: 'company_result', success: false, error: '已有一間公司' })); return; }
        if ((p.money || 0) < 50000) { ws.send(JSON.stringify({ event: 'company_result', success: false, error: '金錢不足' })); return; }
        p.money -= 50000;
        const cid = generateId();
        this.companies.set(cid, { id: cid, name: payload.name, owner: ws.username, industry: payload.industry || 'tech', shares: 1000, cash: 0, level: 1, equip_level: 1, brand_level: 1 });
        p.company_id = cid;
        this.addHolding(ws.username, cid, 1000);
        ws.send(JSON.stringify({ event: 'company_result', success: true, companyId: cid }));
        break;
      }

      case 'get_my_company': {
        if (!p.company_id) { ws.send(JSON.stringify({ event: 'company_data', company: null })); return; }
        const c = this.companies.get(p.company_id);
        if (!c) { ws.send(JSON.stringify({ event: 'company_data', company: null })); return; }
        const emps = [];
        for (const [key, emp] of this.employees) {
          if (key.startsWith(c.id + ':')) emps.push({ username: emp.username, role: emp.role, salary: emp.salary, satisfaction: emp.satisfaction });
        }
        ws.send(JSON.stringify({
          event: 'company_data', company: {
            ...c, employees: emps,
            upgradeCosts: {
              level: Math.floor(50000 * Math.pow(2, c.level - 1)),
              equipment: Math.floor(20000 * Math.pow(1.8, c.equip_level - 1)),
              brand: Math.floor(50000 * Math.pow(1.5, c.brand_level - 1))
            }
          }
        }));
        break;
      }

      case 'upgrade_company': {
        const c = p.company_id ? this.companies.get(p.company_id) : null;
        if (!c) { ws.send(JSON.stringify({ event: 'company_upgrade_result', success: false, error: '沒有公司' })); return; }
        const costs = { level: Math.floor(50000 * Math.pow(2, c.level - 1)), equipment: Math.floor(20000 * Math.pow(1.8, c.equip_level - 1)), brand: Math.floor(50000 * Math.pow(1.5, c.brand_level - 1)) };
        const cost = costs[payload];
        if (!cost || (c.cash || 0) < cost) { ws.send(JSON.stringify({ event: 'company_upgrade_result', success: false, error: '資金不足' })); return; }
        c.cash -= cost;
        if (payload === 'level') c.level++;
        else if (payload === 'equipment') c.equip_level++;
        else if (payload === 'brand') c.brand_level++;
        ws.send(JSON.stringify({ event: 'company_upgrade_result', success: true, [payload]: c[payload], cash: c.cash }));
        break;
      }

      case 'get_market_data': {
        const market = [];
        for (const [cid, c] of this.companies) {
          const companyOrders = this.orders.filter(o => o.cid === cid && (o.status === 'open' || o.status === 'partial'));
          const bestBid = companyOrders.filter(o => o.type === 'buy').sort((a, b) => b.price - a.price)[0];
          const bestAsk = companyOrders.filter(o => o.type === 'sell').sort((a, b) => a.price - b.price)[0];
          market.push({ companyId: cid, companyName: c.name, industry: c.industry, bestBid: bestBid?.price || null, bestAsk: bestAsk?.price || null });
        }
        ws.send(JSON.stringify({ event: 'market_data', market }));
        break;
      }

      case 'get_order_book': {
        const companyOrders = this.orders.filter(o => o.cid === payload && (o.status === 'open' || o.status === 'partial'));
        const buys = companyOrders.filter(o => o.type === 'buy').sort((a, b) => b.price - a.price).slice(0, 20).map(o => ({ price: o.price, quantity: o.qty - o.filled, username: o.username }));
        const sells = companyOrders.filter(o => o.type === 'sell').sort((a, b) => a.price - b.price).slice(0, 20).map(o => ({ price: o.price, quantity: o.qty - o.filled, username: o.username }));
        ws.send(JSON.stringify({ event: 'order_book', buys, sells }));
        break;
      }

      case 'get_portfolio': {
        const portfolio = [];
        for (const [key, qty] of this.holdings) {
          const [uname, cid] = key.split(':');
          if (uname === ws.username) {
            const c = this.companies.get(cid);
            portfolio.push({ companyId: cid, companyName: c?.name || 'Unknown', industry: c?.industry || '', quantity: qty });
          }
        }
        ws.send(JSON.stringify({ event: 'portfolio', portfolio }));
        break;
      }

      case 'get_my_orders': {
        const myOrders = this.orders.filter(o => o.username === ws.username && o.status !== 'cancelled').map(o => ({
          id: o.id, companyId: o.cid, type: o.type, price: o.price, quantity: o.qty, filled: o.filled, status: o.status
        }));
        ws.send(JSON.stringify({ event: 'my_orders', orders: myOrders }));
        break;
      }

      case 'place_order': {
        const { companyId, type, price, quantity } = payload;
        const c = this.companies.get(companyId);
        if (!c) { ws.send(JSON.stringify({ event: 'order_result', success: false, error: '公司不存在' })); return; }
        if (type === 'sell') {
          const key = `${ws.username}:${companyId}`;
          const held = this.holdings.get(key) || 0;
          if (held < quantity) { ws.send(JSON.stringify({ event: 'order_result', success: false, error: '持股不足' })); return; }
        }
        const order = { id: generateId(), cid: companyId, username: ws.username, type, price, qty: quantity, filled: 0, status: 'open' };
        this.orders.push(order);
        this.matchOrders();
        ws.send(JSON.stringify({ event: 'order_result', success: true, orderId: order.id }));
        break;
      }

      case 'cancel_order': {
        const order = this.orders.find(o => o.id === payload && o.username === ws.username);
        if (!order) { ws.send(JSON.stringify({ event: 'cancel_order_result', success: false, error: '不存在' })); return; }
        order.status = 'cancelled';
        ws.send(JSON.stringify({ event: 'cancel_order_result', success: true }));
        break;
      }

      case 'hire_employee': {
        const c = this.companies.get(p.company_id || '');
        if (!c) { ws.send(JSON.stringify({ event: 'hire_result', success: false, error: '沒有公司' })); return; }
        const salaries = { intern: 1, staff: 5, engineer: 20, manager: 50, expert: 200 };
        const hireCosts = { intern: 200, staff: 1000, engineer: 5000, manager: 20000, expert: 100000 };
        const key = `${c.id}:${payload.targetUserId}`;
        if (this.employees.has(key)) { ws.send(JSON.stringify({ event: 'hire_result', success: false, error: '已在公司' })); return; }
        const hireCost = hireCosts[payload.role] || 0;
        if ((c.cash || 0) < hireCost) { ws.send(JSON.stringify({ event: 'hire_result', success: false, error: '資金不足' })); return; }
        c.cash -= hireCost;
        this.employees.set(key, { cid: c.id, username: payload.targetUserId, role: payload.role, salary: salaries[payload.role] || 1, satisfaction: 100 });
        ws.send(JSON.stringify({ event: 'hire_result', success: true }));
        break;
      }

      case 'fire_employee': {
        const c = this.companies.get(p.company_id || '');
        if (!c) { ws.send(JSON.stringify({ event: 'fire_result', success: false, error: '沒有公司' })); return; }
        const key = `${c.id}:${payload}`;
        if (payload === ws.username) { ws.send(JSON.stringify({ event: 'fire_result', success: false, error: '不能開除自己' })); return; }
        this.employees.delete(key);
        ws.send(JSON.stringify({ event: 'fire_result', success: true }));
        break;
      }

      case 'set_salary': {
        const c = this.companies.get(p.company_id || '');
        if (!c) { ws.send(JSON.stringify({ event: 'salary_result', success: false, error: '沒有公司' })); return; }
        const key = `${c.id}:${payload.targetUserId}`;
        const emp = this.employees.get(key);
        if (!emp) { ws.send(JSON.stringify({ event: 'salary_result', success: false, error: '找不到員工' })); return; }
        emp.salary = payload.salary;
        emp.satisfaction = Math.min(100, emp.satisfaction + 5);
        ws.send(JSON.stringify({ event: 'salary_result', success: true, salary: payload.salary, satisfaction: emp.satisfaction }));
        break;
      }

      case 'get_contracts': {
        const templates = [
          { id: 'data_labeling', name: '資料標註', reward: 500, duration: 120000, minIncome: 0 },
          { id: 'server_hosting', name: '伺服器託管', reward: 2000, duration: 300000, minIncome: 50 },
          { id: 'software_dev', name: '軟體開發', reward: 10000, duration: 900000, minIncome: 200, requireEngineers: 2 },
          { id: 'system_maintenance', name: '系統維護', reward: 25000, duration: 1800000, minIncome: 500, requireManager: 1 },
          { id: 'emergency_rescue', name: '緊急救援', reward: 100000, duration: 3600000, minIncome: 1000, requireEmployees: 5 },
        ];
        const active = [];
        for (const [id, c] of this.contracts) {
          if (c.username === ws.username) active.push({ id: c.id, name: c.name, reward: c.reward, status: c.status, expiresAt: c.expires_at });
        }
        ws.send(JSON.stringify({ event: 'contracts_data', templates, active }));
        break;
      }

      case 'accept_contract': {
        const templates = [
          { id: 'data_labeling', name: '資料標註', reward: 500, duration: 120000, minIncome: 0 },
          { id: 'server_hosting', name: '伺服器託管', reward: 2000, duration: 300000, minIncome: 50 },
          { id: 'software_dev', name: '軟體開發', reward: 10000, duration: 900000, minIncome: 200, requireEngineers: 2 },
          { id: 'system_maintenance', name: '系統維護', reward: 25000, duration: 1800000, minIncome: 500, requireManager: 1 },
          { id: 'emergency_rescue', name: '緊急救援', reward: 100000, duration: 3600000, minIncome: 1000, requireEmployees: 5 },
        ];
        const tpl = templates.find(t => t.id === payload);
        if (!tpl) { ws.send(JSON.stringify({ event: 'contract_result', success: false, error: '不存在' })); return; }
        if ((p.incomePerMinute || 1) < tpl.minIncome) { ws.send(JSON.stringify({ event: 'contract_result', success: false, error: '收入不足' })); return; }
        const cid = generateId();
        this.contracts.set(cid, { id: cid, username: ws.username, name: tpl.name, reward: tpl.reward, status: 'in_progress', expires_at: Date.now() + tpl.duration });
        ws.send(JSON.stringify({ event: 'contract_result', success: true, contractId: cid, duration: tpl.duration }));
        break;
      }

      default:
        ws.send(JSON.stringify({ event: 'error', message: `Unknown event: ${event}` }));
    }
  }
}

function safeParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
