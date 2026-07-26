# Earth Online v3.1 — Cloudflare Workers 全面遷移

> 目標：移除 Render 後端，全部搬到 Cloudflare Workers（免費方案）

---

## 新架構

```
Browser (twonline.dpdns.org)
  │
  ├── Workers Assets ─── 靜態檔案 (React)
  │
  ├── Worker HTTP ────── 登入、註冊、排行榜、Discord OAuth
  │
  └── Durable Object ─── WebSocket 即時通訊 + 遊戲 tick + 資料存儲
       ├── DO Storage SQLite ── 玩家錢/升級/股票/公司等遊戲資料
       └── D1 ──────────────── 只存帳號密碼
```

---

## 檔案結構

```
earthonline/
├── src/
│   ├── index.js          ← Worker 入口 (HTTP 路由 + Assets)
│   ├── do/
│   │   ├── GameRoom.js   ← Durable Object (遊戲引擎 + WebSocket)
│   │   ├── auth.js       ← 認證邏輯 (JWT/bcrypt)
│   │   └── utils.js      ← 共用工具
│   └── db/
│       └── schema.sql    ← D1 初始 Schema
├── client/
│   └── src/
│       └── hooks/
│           └── useSocket.js  ← 改為原生 WebSocket
├── wrangler.jsonc
└── migrations/
    └── 0000_create_db.sql
```

---

## Phase 1 — D1 Schema + 登入系統

### D1 Tables

| Table | 用途 | 重要欄位 |
|-------|------|---------|
| `accounts` | 帳號 | id, username, password_hash, discord_id, discord_username, discord_avatar, role, created_at |
| `email_verifications` | 信箱驗證 | account_id, email, token, expires_at |

### Worker HTTP Routes

| Method | Path | 功能 |
|--------|------|------|
| POST | `/api/register` | 註冊 (bcrypt hash) |
| POST | `/api/login` | 登入 (回傳 JWT) |
| GET | `/api/auth/discord` | Discord OAuth |
| GET | `/api/auth/discord/callback` | Discord callback |
| GET | `/api/:region/leaderboard` | 排行榜 |
| GET | `/api/global/stats` | 全域統計 |
| GET | `/health` | 健康檢查 |

---

## Phase 2 — Durable Object GameRoom

### 初始化 (blockConcurrencyWhile)

```sql
CREATE TABLE IF NOT EXISTS players (
  username TEXT PRIMARY KEY,
  money REAL DEFAULT 0,
  income_per_minute REAL DEFAULT 1,
  total_earned REAL DEFAULT 0,
  upgrades TEXT DEFAULT '{}',
  investments TEXT DEFAULT '{}',
  company_id TEXT DEFAULT NULL,
  country TEXT DEFAULT 'TW',
  lat REAL DEFAULT 0,
  lon REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  industry TEXT DEFAULT 'tech',
  shares INTEGER DEFAULT 1000,
  cash REAL DEFAULT 0,
  level INTEGER DEFAULT 1,
  equip_level INTEGER DEFAULT 1,
  brand_level INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employees (
  company_id TEXT,
  username TEXT,
  role TEXT DEFAULT 'employee',
  salary REAL DEFAULT 1,
  satisfaction REAL DEFAULT 100,
  PRIMARY KEY (company_id, username)
);

CREATE TABLE IF NOT EXISTS stock_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  filled INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_holdings (
  company_id TEXT NOT NULL,
  username TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  PRIMARY KEY (company_id, username)
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  started_at INTEGER,
  expires_at INTEGER
);
```

### WebSocket Events

| Client → Server | Server → Client |
|-----------------|-----------------|
| `auth` (JWT) | `init_data` |
| `sync` | `user_state` |
| `buy_upgrade` | `upgrade_result` |
| `invest` | `invest_result` |
| `withdraw_invest` | `invest_result` |
| `place_order` | `order_result` |
| `cancel_order` | `order_result` |
| `create_company` | `company_result` |
| `hire_employee` | `company_data` |
| `fire_employee` | `company_data` |
| `upgrade_company` | `company_data` |
| `accept_contract` | `contract_result` |

### Tick System (Alarm)

每 5 秒觸發 alarm：
1. 加錢給所有在線玩家
2. 公司營運利潤
3. 股票撮合
4. 合約到期檢查
5. 每 60 秒一次批量寫入 DO Storage

---

## Phase 3 — 前端改寫

### 替換 socket.io-client → 原生 WebSocket

`client/src/hooks/useSocket.js` 改為：

```js
// 原本
import { io } from 'socket.io-client';
const socket = io(url);

// 改為
const ws = new WebSocket(`wss://twonline.dpdns.org/ws/${region}`);
```

所有 `socket.emit('event', data)` → `ws.send(JSON.stringify({event, data}))`
所有 `socket.on('event', cb)` → `switch(message.event) { ... }`

---

## 執行順序

```
Day 1 ── D1 Schema + Worker HTTP routes + Discord OAuth
Day 2 ── Durable Object 遊戲引擎 (tick + WebSocket)
Day 3 ── 前端 WebSocket 改寫 + 整合測試
Day 4 ── 部署上線 + 除錯
```
