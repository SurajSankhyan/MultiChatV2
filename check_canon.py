import urllib.request
import re

url = 'https://www.youtube.com/@surajsankhyanv7/live'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = urllib.request.urlopen(req)
    html = resp.read().decode('utf-8')
    match = re.search(r'<link\s+rel="canonical"[^>]+>', html)
    if match:
        print("canonical link tag:", match.group(0))
except Exception as e:
    print(e)
