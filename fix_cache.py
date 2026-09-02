import re

with open('multichat/utils/youtubeChat.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix 1: Stop saving by channel name
code = re.sub(
    r'const next = \{ \.\.\.JSON\.parse\(stored\), \[pollInstance\.videoId\]: iStartTime, \[trimmedName\]: iStartTime, \[rawClean\]: iStartTime, \[@\$\{rawClean\}\]: iStartTime \};',
    r'const next = { ...JSON.parse(stored), [pollInstance.videoId]: iStartTime };',
    code
)

# Fix 2: Stop retrieving by channel name in join()
code = re.sub(
    r'\} else if \(parsed\[trimmedName\]\) \{\s*localStartTime = parsed\[trimmedName\];\s*isExactStartTime = true;\s*\}',
    r'',
    code
)
# Wait, let's also remove rawClean from the retrieval if it exists
code = re.sub(
    r'\} else if \(parsed\[rawClean\]\) \{\s*localStartTime = parsed\[rawClean\];\s*isExactStartTime = true;\s*\}',
    r'',
    code
)
code = re.sub(
    r'\} else if \(parsed\[@\$\{rawClean\}\]\) \{\s*localStartTime = parsed\[@\$\{rawClean\}\];\s*isExactStartTime = true;\s*\}',
    r'',
    code
)


with open('multichat/utils/youtubeChat.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('Fixed localStorage caching!')
