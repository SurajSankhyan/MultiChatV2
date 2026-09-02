with open('multichat/utils/youtubeChat.js', 'r', encoding='utf-8') as f:
    code = f.read()

target1 = "const next = { ...JSON.parse(stored), [pollInstance.videoId]: iStartTime, [trimmedName]: iStartTime, [rawClean]: iStartTime, [@\]: iStartTime };"
replacement1 = "const next = { ...JSON.parse(stored), [pollInstance.videoId]: iStartTime };"
code = code.replace(target1, replacement1)

# Now in join()
target2 = '''            if (parsed[videoId]) {
              localStartTime = parsed[videoId];
              isExactStartTime = true;
            } else if (parsed[trimmedName]) {
              localStartTime = parsed[trimmedName];
              isExactStartTime = true;
            }'''
replacement2 = '''            if (parsed[videoId]) {
              localStartTime = parsed[videoId];
              isExactStartTime = true;
            }'''
code = code.replace(target2, replacement2)

with open('multichat/utils/youtubeChat.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('Fixed localStorage caching string replace!')
