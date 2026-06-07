import re

with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find any function component definition:
# 1. function ComponentName(props) {
# 2. const ComponentName = (props) => {
# 3. const ComponentName = function(props) {

# We'll inject `const { t, language, setLanguage } = useLanguage();` right after `{`

def repl(m):
    original = m.group(0)
    # Don't inject if it's already there
    block = content[m.end():m.end()+150]
    if 'useLanguage()' in block:
        return original
    
    # Exclude ErrorBoundary and similar non-function components (if any, but the regex targets [A-Z])
    return original + "\n  const { t, language, setLanguage } = useLanguage();"

# Match 'function ComponentName(...) {'
content = re.sub(r'(function\s+[A-Z][a-zA-Z0-9]*\s*\([^)]*\)\s*\{)', repl, content)

# Match 'const ComponentName = (...) => {'
content = re.sub(r'(const\s+[A-Z][a-zA-Z0-9]*\s*=\s*\([^)]*\)\s*=>\s*\{)', repl, content)

# Write back
with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched all components with useLanguage!")
