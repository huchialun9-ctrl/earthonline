# Earth Online — 開發路線圖 (Current → v1.14.0 → v2.0.0+)

> 基於 v2.0.0-planning.md 與 2025-06-11 專案審計結果整合
> 每個小版號為可獨立部署、不破壞現有遊戲的增量更新
> 目標：v1.14.0 正式發布

---

## 目前進度

已完成：v1.8.x(v1.8.1~v1.8.4 後端重構)、v1.9.x(v1.9.1~v1.9.4 前端重構)、v1.10.x(v1.10.1~v1.10.3 經濟重塑)、v1.11.x(v1.11.1~v1.11.4 事件&目標)、v1.12.x(v1.12.1~v1.12.3 離線收益+天賦)
進行中：v1.12.4 區域對抗

---

## 審計重點摘要（2025-06-11）

| 嚴重度 | 數量 | 關鍵項目 |
|--------|------|---------|
| Critical | 7 | Secrets 外洩、弱 JWT Secret、Wildcard CORS、重複函數、crash.log 未 gitignore、IP 日誌洩漏 |
| High | 9 | Helmet 關閉、App.jsx 2719 行、server.js 761 行、重複程式碼、未使用 import、遺漏 rate limit、未定義變數、無 token 撤銷 |
| Medium | 9 | 遺漏輸入驗證、FP 精度、重複結算邏輯、50 人限制、100 次 Discord 查詢、console.log |
| Low | 10 | 無 lint、React keys、硬編碼字串、遺漏索引、靜默 catch |

---

## v1.12.x — 深度新功能

### v1.12.4 — 區域對抗系統

- **v1.12.4a 區域指標收集 (backend)**
  - **做什麼：** 在 regionState.js 新增 warStats（totalOnlineTime、avg/peak users、eventsCompleted、totalPTEarned），在 gameLoop 每 tick 更新
  - **改哪個檔案：** `backend/state/regionState.js`、`backend/services/gameLoop.js`、`backend/server.js`
  - **驗證：** 區域統計數據正確累積，socket 查詢返回即時三區對比
  - **狀態：** ✅ 已完成

- **v1.12.4b 區域結算 + 獎勵 (backend)**
  - **做什麼：** 整合 warStats 到 settlementService，結算時發放區域排名獎勵（冠軍全區 +200 PT + 邊框，亞軍 +100 PT，個人前 10 +500 PT）
  - **改哪個檔案：** `backend/services/settlementService.js`、`backend/state/regionState.js`
  - **驗證：** 結算時區域排名正確、獎勵正確發放

- **v1.12.4c 前端區域對抗面板 (frontend)**
  - **做什麼：** 新增三欄即時對比面板 UI，顯示各區 stats、本週趨勢、個人貢獻
  - **改哪個檔案：** `client/src/App.jsx`、`client/src/i18n.js`
  - **驗證：** 三欄即時對比顯示、socket 實時更新

### v1.12.5 — 多背景風格系統

- **v1.12.5a 背景架構 + Style 1 保留**
  - **做什麼：** 建立 `client/src/components/Backgrounds/` 目錄與 router，保留 EarthGlobe 為 Style 1
  - **改哪個檔案：** `client/src/components/Backgrounds/index.jsx`（新建）
  - **驗證：** 背景切換不影響 EarthGlobe 功能

- **v1.12.5b Style 2: 伺服器機房 (ServerRoom)**
  - **做什麼：** 新增伺服器機櫃動畫背景，刀片閃爍對應在線節點
  - **改哪個檔案：** `client/src/components/Backgrounds/ServerRoom.jsx`（新建）
  - **驗證：** 機房動畫正常渲染

- **v1.12.5c Style 3~5 + 切換 UI**
  - **做什麼：** 加入星雲(Nebula)、雷達(RadarTerminal)、賽博城市(CyberCity) + 設定面板切換
  - **改哪個檔案：** 3 個新背景元件 + `client/src/App.jsx` + `client/src/i18n.js`
  - **驗證：** 5 種背景可自由切換、儲存在 localStorage

---

## v1.13.x — 系統優化與安全

### v1.13.1 — 安全修正 (Critical)

- **v1.13.1a 修復外洩 secrets**
  - **做什麼：** 將 `.env` 從 git 移除，輪換所有 exposed secrets（JWT_SECRET、DISCORD_CLIENT_SECRET），更新為 crypto.randomBytes(64) 強密碼
  - **改哪個檔案：** `.gitignore`、`backend/.env`、`backend/config/env.js`
  - **驗證：** `git status` 顯示 .env 不再被追蹤

- **v1.13.1b 修復 CORS 與啟用 helmet**
  - **做什麼：** 限制 Socket.io CORS 為白名單域名，重新啟用 helmet（設定 CSP 允許 Socket.io）
  - **改哪個檔案：** `backend/server.js`
  - **驗證：** 外部域名無法連接 WebSocket，安全 headers 正確發送

- **v1.13.1c 修復 crash.log 與 IP 洩漏**
  - **做什麼：** crash.log 加入 gitignore，移除 stdout IP 日誌
  - **改哪個檔案：** `.gitignore`、`backend/server.js`
  - **驗證：** crash.log 不再被 git 追蹤

- **v1.13.1d 修復 terminalHandler 未定義變數**
  - **做什麼：** 補上 INVEST_MAX_LEVEL 和 INVEST_COSTS 常數
  - **改哪個檔案：** `backend/socket/terminalHandler.js`
  - **驗證：** `/INVEST` 指令不再噴 ReferenceError

- **v1.13.1e 移除重複程式碼**
  - **做什麼：** 移除 obfuscateIp()、getEventDuration()、sendDiscordWebhook() 重複定義
  - **改哪個檔案：** `backend/server.js`、`backend/routes/auth.js`、`backend/services/eventSystem.js`、`backend/socket/terminalHandler.js`
  - **驗證：** 共用函數只定義一次，所有引用處正常工作

- **v1.13.1f 清理未使用 import**
  - **做什麼：** 移除 server.js 中未使用的 import（helmet、bcrypt、jwt、nodemailer 等）
  - **改哪個檔案：** `backend/server.js`
  - **驗證：** Node.js 啟動無警告

### v1.13.2 — 效能優化 (Medium)

- **v1.13.2a MongoDB Indexes**
  - **做什麼：** 補上 homeRegion、accumulatedTime、weeklyScore 的查詢索引
  - **改哪個檔案：** `backend/models/User.js`
  - **驗證：** MongoDB 查詢使用正確索引

- **v1.13.2b 快取層**
  - **做什麼：** regionPopulation 快取 30s、leaderboard 快取 5s、roleCache TTL 維持 1min
  - **改哪個檔案：** `backend/server.js`、`backend/routes/leaderboard.js`
  - **驗證：** countDocuments 呼叫次數減少

- **v1.13.2c App.jsx 組件拆分**
  - **做什麼：** 將 LoginGateway、CountdownBanner、DonateBanner、FourPetalSpiral 抽出到獨立檔案
  - **改哪個檔案：** `client/src/components/LoginGateway.jsx`、`CountdownBanner.jsx`、`DonateBanner.jsx`、`FourPetalSpiral.jsx`（新建） + `client/src/App.jsx`
  - **驗證：** UI 行為與拆分前完全一致

- **v1.13.2d 統一 Discord 角色分配**
  - **做什麼：** 整合 assignExclusiveRole 和 assignWeeklyRoles 為單一函數
  - **改哪個檔案：** `backend/discordBot.js`
  - **驗證：** 週 cron 正常執行

### v1.13.3 — 開發體驗

- **v1.13.3a ESLint + Prettier**
  - **做什麼：** 加入 linting 與格式化設定
  - **改哪個檔案：** `.eslintrc.cjs`、`.prettierrc`（新建） + `package.json`（兩端）
  - **驗證：** `npm run lint` 正常執行

- **v1.13.3b Rate Limiting 補完**
  - **做什麼：** 為 Discord OAuth 端點加入 rate limit
  - **改哪個檔案：** `backend/server.js`
  - **驗證：** 短時間大量請求被正確限制

- **v1.13.3c 離線補償防重複**
  - **做什麼：** 限制每 5min 最多一次離線補償
  - **改哪個檔案：** `backend/server.js`
  - **驗證：** 短時間重複連線只補償一次

### v1.13.4 — 壓力測試

- **v1.13.4a 大量連線模擬**
  - **做什麼：** 測試 100/500 同時連線，確認 tick delay < 100ms
  - **改哪個檔案：** `backend/scripts/stress-test.js`（新建）
  - **驗證：** 高併發下 tick 正常

- **v1.13.4b 邊界情況驗證**
  - **做什麼：** 檢查健康度 <0/>100、背包負數、Buff 過期
  - **改哪個檔案：** `backend/services/gameLoop.js`、`backend/services/shopService.js`
  - **驗證：** 所有邊界情況正確處理

- **v1.13.4c 完整回歸測試**
  - **做什麼：** 跑一遍所有功能（登入、掛機、商城、背包、事件、任務、成就、天賦、區域對抗）
  - **驗證：** 所有功能正常

---

## v1.14.0 — 正式發布

- **v1.14.0a 更新 README.md**
  - **做什麼：** 完整遊戲規則說明、新功能使用指南
  - **改哪個檔案：** `README.md`
  - **驗證：** 文件涵蓋所有功能

- **v1.14.0b 更新 AGENTS.md**
  - **做什麼：** 開發指引更新為新架構
  - **改哪個檔案：** `AGENTS.md`
  - **驗證：** 開發指引準確反映當前架構

- **v1.14.0c 更新 CHANGELOG**
  - **做什麼：** 所有 v1.8.x ~ v1.13.x 版本摘要
  - **改哪個檔案：** `CHANGELOG.md`（新建）
  - **驗證：** 版本歷史完整

- **v1.14.0d dev → main merge + CF Pages 部署**
  - **做什麼：** 合併 dev 到 main，確認部署成功
  - **驗證：** earthonline1.pages.dev 正常訪問

---

## v2 — 《地球在線 Earth Online》專案陳述書 (Project Statement)

> 去 AI 化、純粹回歸復古美式點陣美學的「全球文明開採模擬掛機網頁遊戲」

### 核心定位

機制極致單純（放置掛機、升級、抽獎），但利用「全服限量絕版神物」的 FOMO 心理，以及「三大伺服器氣運對抗」的集體榮譽感，驅使玩家 24 小時瘋狂掛機並深度黏著於社群。

### 視覺美術風格

徹底拋棄所有冷冰冰的科技線條、科幻霓虹與平滑的 AI 風格，全面採用美式重工業復古點陣（Pixel Art）與極具厚重感的像素配色。

- **登入與條約頁：** 背景採用深褐色粗糙礦岩點陣紋理。中央登入框為深灰色半透明面板，四周圍繞薄薄的亮綠色發光邊框。底部條約使用深邃的草地綠點陣條，文字一律採用粗白點陣體加黑色陰影。
- **頂部固定導航欄：** 材質採用「深石磚灰色」點陣紋理，上方壓有一條草地綠細線。左側 LOGO 為黃色立體爆裂紋藝術字。
- **分類拉頁選單：** 背景完全比照經典的「深灰色格子物品欄」清單視覺。滑鼠懸停時，方格會亮起標誌性的亮青色（Cyan）像素外框，並伴隨機械按鍵音效。
- **3D 立體像素藝術字 (Pixel WordArt)：** 網站內的所有核心標題與陣營名稱，一律採用重度渲染、帶有黑色粗邊框與飽和漸層色的 3D 像素立體街機藝術字，展現重工業與資源開採的宏大力量感。

### 第一關：門神與公約

玩家進入網站後，必須先通過「身分綁定/登入區」（支援 Discord 一鍵登入）。強制閱讀並勾選同意底部的《市民公約條約》，立體的灰色按鈕才會亮起允許進入。

### 第二關：引導式文檔與陣營介紹

通過登入後，進入單頁向下滾動的引導頁。

- **全球開採指南：** 以深色硬質合金面板呈現獨立世界觀文檔，徹底切割市面其他遊戲的機制字眼。
- **實景點陣化陣營圖：** 展示三張經過「高飽和度點陣化濾鏡」處理的真實世界巨型建築照片（台北101、自由女神、巴黎鐵塔），作為三大陣營的引導：
  - 🔴 🚩 亞 洲 陣 營 (大本營：台北/東京) — 盛產地心深層礦脈。
  - 🔵 🔷 美 洲 陣 營 (大本營：紐約) — 金融與商業帝國。
  - 🟢 🟢 歐 洲 陣 營 (大本營：倫敦/巴黎) — 埋藏極高的遠古氣運。

### 第三關：滿版滑動大地圖與派遣掛機

點擊底部閃爍的「踏入世界」金幣按鈕後，正式展現主遊戲畫面：

- **自由滑動與縮放：** 滿畫面的 2D 像素真實世界地圖（包含各國國旗）。玩家可自由拖曳、並透過滾輪放大查看微觀國家，或縮小俯瞰全球局勢。
- **跨國派遣掛機：** 點擊任何一個國家，會跳出該國的真實數據情報窗。玩家點擊「在此建立我的礦場」，右側掛機面板即開始自動跳錢。
- **五大礦層升級：** 玩家唯一的基礎目標是累積資金，由淺入深升級礦層（Lv.1 碎石地層 → Lv.2 沉積礦脈 → Lv.3 閃耀鑽石 → Lv.4 暗物質礦 → Lv.5 地球星核），產出速度呈指數級飆升。
- **萬人開採反饋：** 玩家派遣礦場至某國後，世界地圖上該國國旗上方會實時冒出無數小小的「十字鎬」像素敲擊動畫，形成壯觀的全球開採畫面。

### 第四關：全服限量秘寶抽獎（賭狗與絕版機制）

當玩家手握地心開採的巨額資金時，可消耗百億資金點擊中央的【探尋地球秘寶】按鈕，隨機抽取不同稀有度的神物：

- **普通 (Common) [89.99%]：** 古老恐龍化石（無特效，可一鍵熔煉為「幸運晶石」進行礦場轉生，永久提升下一輪開採速度）。
- **史詩 (Epic) [9.9%]：** 摩艾石像、埃及木乃伊等（個人掛機速度永久 +5%）。
- **神話 (Mythic) [0.1%]：** 每個國家限量 1 個（如：台北101模型、自由女神火炬）。個人掛機速度 +20%，且對應國家地圖會亮起專屬特效。
- **獨特 (Unique) [0.001%]：** 全伺服器僅此 1 個（如：【始皇帝的傳國玉璽】）。擁有全服唯一的地圖懸浮動態特效與 Discord 閃爍身分組。
- **⚠️ 錯失恐懼機制 (FOMO)：** 一旦全服唯一的神物被某位玩家抽走，全服抽獎池的該庫存立刻歸零，徹底絕版。

### 100% 真實數據底層架構 (Real-Time Data Integrity)

為了確保遊戲的硬核性質與對抗體驗，本專案承諾所有數據拒絕黑箱與隨機敷衍，100% 採用後端實時數據連動與公示：

- **真實在線人數：** 利用高速快取資料庫 (Redis Set) 實時監聽與統計玩家當前將礦場掛在哪個國家。玩家離線或切換國家，地圖數據實時 +1 或 -1。
- **真實國家 GDP：** 點擊國家顯示的「總資源產出/秒」，是由當前在線且派遣在該國的所有玩家的「真實開採時薪」實時加總計算而成。高階玩家轉移陣地，會直接引發世界地圖上該國數據的暴漲。
- **真・限量庫存鎖 (Database Row Lock)：** 全服唯一神物在資料庫採用嚴格的行級鎖定。一旦扣減成功，不論多高併發的毫秒級抽獎，後端檢查到庫存為 0 即拒絕發放，保證絕版神物的稀缺與真實性。
- **全服氣運值實時加總：** 系統每 5 分鐘實時重新計算（SUM）三大伺服器陣營玩家所擁有的神物總權重與轉生次數。氣運排行榜第一名的陣營板塊，網頁大地圖上會真實渲染出比其他板塊更耀眼的金色粒子發光特效。

### 反作弊與安全性承諾 (Anti-Cheat Security)

由於遊戲數據 100% 真實，本專案防範一切前端外掛與 F12 竄改網頁代碼之作弊行為：

- **資產權限在後端：** 前端（瀏覽器）數字跳動僅為視覺效果。玩家點擊升級或抽獎時，後端會根據資料庫記錄的「上次存檔時間」與「理論每秒產出」在伺服器端重新計算，防範按鍵精靈與代碼修改。
- **安全抽獎校驗：** 抽獎隨機數由後端伺服器安全生成，前端網頁僅負責播放方塊加載與金光閃爍的動畫。

---

## 總版本時程表

| 版本 | 主題 | 相依性 | 優先級 |
|------|------|--------|--------|
| v1.12.4 | 區域對抗系統 | v1.11.4 | High |
| v1.12.5 | 多背景風格系統 | — | Medium |
| v1.13.1 | 安全修正 | — | Critical |
| v1.13.2 | 效能優化 | v1.13.1 | Medium |
| v1.13.3 | 開發體驗 | — | Low |
| v1.13.4 | 壓力測試 | v1.13.2 | Low |
| v1.14.0 | 正式發布 | 全部 | High |

---

## 版本標記規則

```
✅ = 已完成
⬜ = 待執行
🔴 = 阻塞
```

> 最後更新：2025-06-11
