import urllib.request
import re

url = 'https://www.youtube.com/watch?v=1X3-MSfw_AE'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    match = re.search(r'<title>([^<]+)</title>', html)
    if match:
        print("title:", match.group(1))
except Exception as e:
    print(e)
