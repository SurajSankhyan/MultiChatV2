import os
files = [
    'app/api/youtube/proxy/route.ts',
    'app/api/youtube/live-info/route.ts'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'export const dynamic' not in content:
        content = "export const dynamic = 'force-dynamic';\nexport const revalidate = 0;\n\n" + content
        
        # also replace etch(targetUrl, { headers }) with etch(targetUrl, { headers, cache: 'no-store' })
        content = content.replace("fetch(targetUrl, { headers })", "fetch(targetUrl, { headers, cache: 'no-store' })")
        
        # for live-info
        content = content.replace("fetch(url, {\n      headers", "fetch(url, {\n      cache: 'no-store',\n      headers")
        content = content.replace("fetch(endpoint, {\n        method", "fetch(endpoint, {\n        cache: 'no-store',\n        method")
        content = content.replace("fetch(watchUrl, {\n      headers", "fetch(watchUrl, {\n      cache: 'no-store',\n      headers")
        content = content.replace("fetch(chatUrl, {\n      headers", "fetch(chatUrl, {\n      cache: 'no-store',\n      headers")
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {file}")
    else:
        print(f"Already fixed {file}")
