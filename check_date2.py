import urllib.request
import re

url = 'https://www.youtube.com/watch?v=iamLOl7PFLs'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    match = re.search(r'"startDate"\s*:\s*"([^"]+)"', html)
    if match:
        print("startDate:", match.group(1))
except Exception as e:
    print(e)
