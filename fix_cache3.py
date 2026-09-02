with open('multichat/utils/youtubeChat.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''    const fetchTimeout = async (target, opts = {}) => {
      const controller = new AbortController();'''

replacement = '''    const fetchTimeout = async (target, opts = {}) => {
      opts = { cache: 'no-store', ...opts };
      const controller = new AbortController();'''

if target in code:
    code = code.replace(target, replacement)
    with open('multichat/utils/youtubeChat.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed fetch caching!")
else:
    print("Target not found!")
