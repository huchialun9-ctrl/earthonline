import re

with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if "import { getTranslation } from './i18n';" not in content:
    content = content.replace(
        "import React, { useState, useEffect, useRef, useCallback } from 'react';",
        "import React, { useState, useEffect, useRef, useCallback } from 'react';\nimport { getTranslation } from './i18n';"
    )

# 2. Add language state inside App component
if "const [language, setLanguage]" not in content:
    content = content.replace(
        "const [region, setRegion] = useState('asia');",
        "const [region, setRegion] = useState('asia');\n  const [language, setLanguage] = useState('zh');"
    )

# 3. Add translation helper inside App component
if "const t = (key) => getTranslation(language, key);" not in content:
    content = content.replace(
        "const [language, setLanguage] = useState('zh');",
        "const [language, setLanguage] = useState('zh');\n\n  // Change language automatically based on region on first load\n  useEffect(() => {\n    setLanguage(region === 'asia' ? 'zh' : 'en');\n  }, [region]);\n\n  const t = (key) => getTranslation(language, key);"
    )

# 4. Add Language Toggle button in Header
# Finding the Region selector button
header_region_pattern = r'<button\s+onClick=\{[^}]+\}\s+className="header-btn region-btn"[^>]*>.*?<\/button>'
def add_lang_btn(match):
    original = match.group(0)
    lang_btn = '\n          <button onClick={() => setLanguage(language === \'zh\' ? \'en\' : \'zh\')} className="header-btn">\n            <span className="icon">🌐</span>\n            {t("語言")}: {language === \'zh\' ? \'中文\' : \'EN\'}\n          </button>'
    return original + lang_btn

if "setLanguage(language" not in content:
    content = re.sub(header_region_pattern, add_lang_btn, content, flags=re.DOTALL)

# 5. Now we replace known exact strings in JSX
# List of known strings that are directly in JSX like <div>中文</div>
texts_to_translate = [
    "全球總人數", "全球線上人數", "伺服器總人口", "伺服器線上人數",
    "全球總掛機時間", "伺服器即時負載", "連線延遲", "伺服器狀態",
    "連線穩定", "中斷", "登出 / 切換帳號", "社群", "官方 Discord",
    "贊助支持", "贊助創作者", "使用者帳號", "已連結 Discord",
    "立即連結 Discord", "總生存時間", "健康狀態", "網路連線狀態",
    "上傳", "下載", "封包遺失", "區間群聚超載系統",
    "當前伺服器共同在線掛機人數", "後台點數產出倍率",
    "世界頻道 / 系統日誌", "發送", "定位我的節點",
    "衛星", "暗黑", "街道", "伺服器微服務升級募資計畫",
    "為了打造真正的全球無上限微服務架構，我們計畫在 Render 上建立硬體分流叢集（包含獨立的 Redis 與三大洲 Web Service）。",
    "真實硬體分流，乘載量無上限。",
    "設定較複雜，且 Render 的 Redis 與多台伺服器將產生高昂月費。",
    "優點", "缺點", "贊助伺服器升級", "連線中..", "地球在線",
    "區域", "節點所在", "地球在線連線建立中...", "驗證金鑰已發送，等待授權...",
    "確認：節點", "登入網路", "授權過期，請重新登入", "每週任務結算",
    "獲取", "專屬身分組", "距離結算剩餘", "系統選單"
]

# We must be careful to only replace text nodes, not code.
# The easiest safe way is to regex search for >TEXT< or 'TEXT' or "TEXT"
for text in texts_to_translate:
    # >Text<
    content = content.replace(f">{text}<", f">{{t('{text}')}}<")
    # "Text" in properties
    content = content.replace(f'"{text}"', f"t('{text}')")
    # 'Text' in code (might be tricky, let's use word boundaries or just specific replacements)
    
# Manual targeted replacements for cases that didn't match
content = content.replace('placeholder="輸入訊息，與全球節點交流..."', 'placeholder={t("輸入訊息，與全球節點交流...")}')
content = content.replace("alert('授權過期，請重新登入')", "alert(t('授權過期，請重新登入'))")

with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched App.jsx successfully.")
