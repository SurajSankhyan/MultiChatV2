with open('app/ytproxy/[...path]/route.ts', 'r', encoding='utf-8') as f:
    content = f.read()

if 'export const dynamic' not in content:
    content = "export const dynamic = 'force-dynamic';\nexport const revalidate = 0;\n\n" + content
    
    # also replace etch(targetUrl, { headers }) with etch(targetUrl, { headers, cache: 'no-store' })
    content = content.replace("fetch(targetUrl, { headers", "fetch(targetUrl, { cache: 'no-store', headers")
    content = content.replace("fetch(targetUrl, { method", "fetch(targetUrl, { cache: 'no-store', method")
    
    with open('app/ytproxy/[...path]/route.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed ytproxy route")
else:
    print("Already fixed")
