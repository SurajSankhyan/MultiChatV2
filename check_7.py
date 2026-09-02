import urllib.request
import re

url = 'https://www.youtube.com/watch?v=7eLqvW2GbCw'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    match1 = re.search(r'itemprop="startDate"\s+content="([^"]+)"', html)
    if match1:
        print("startDate:", match1.group(1))
    
    match2 = re.search(r'"actualStartTime"\s*:\s*"([^"]+)"', html)
    if match2:
        print("actualStartTime:", match2.group(1))
        
    match3 = re.search(r'"startTimestamp"\s*:\s*"([^"]+)"', html)
    if match3:
        print("startTimestamp:", match3.group(1))
except Exception as e:
    print(e)
