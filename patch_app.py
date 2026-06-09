import re

with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace 全球總人口 with {t('本伺服器總人口')}
content = content.replace("全球總人口", "{t('本伺服器總人口')}")

with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced global population text")
