with open('multichat/utils/youtubeChat.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''      const res = await fetch(/api/youtube/live-info?videoId=, {
        signal: controller.signal
      });'''

replacement = '''      const res = await fetch(/api/youtube/live-info?videoId=, {
        cache: 'no-store',
        signal: controller.signal
      });'''

if target in code:
    code = code.replace(target, replacement)
    with open('multichat/utils/youtubeChat.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed live-info fetch caching!")
else:
    print("Target not found!")
