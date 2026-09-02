import os
import glob

files = glob.glob('app/ytproxy/**/route.ts', recursive=True) + glob.glob('app/api/youtube/**/route.ts', recursive=True)

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'export const dynamic' not in content:
            content = "export const dynamic = 'force-dynamic';\nexport const revalidate = 0;\n\n" + content
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed {file}")
    except Exception as e:
        print(f"Error {file}: {e}")
