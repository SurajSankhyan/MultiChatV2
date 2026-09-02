with open('multichat/utils/youtubeChat.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''      const menuParams = menuEndpoint?.payload?.params ||
                         menuEndpoint?.liveChatItemContextMenuEndpoint?.params ||
                         menuEndpoint?.contextMenuEndpoint?.params ||
                         menuEndpoint?.params ||
                         (typeof menuEndpoint === 'string' ? menuEndpoint : null);'''

replacement = '''      const menuParams = menuEndpoint?.payload?.params ||
                         menuEndpoint?.command?.liveChatItemContextMenuEndpoint?.params ||
                         menuEndpoint?.liveChatItemContextMenuEndpoint?.params ||
                         menuEndpoint?.contextMenuEndpoint?.params ||
                         menuEndpoint?.params ||
                         (typeof menuEndpoint === 'string' ? menuEndpoint : null);'''

if target in code:
    code = code.replace(target, replacement)
    with open('multichat/utils/youtubeChat.js', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed menuParams!")
else:
    print("Target not found!")
