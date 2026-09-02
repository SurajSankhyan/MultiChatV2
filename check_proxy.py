import urllib.request
import urllib.parse
import json
import re

url = 'http://localhost:3000/api/youtube/proxy'
payload = {'url': 'https://www.youtube.com/@surajsankhyanv7/live'}
req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    html = data.get('html', '')
    print("Found HTML length:", len(html))
    
    matches = re.findall(r'watch\?v=([a-zA-Z0-9_-]{11})', html)
    print("Found video IDs in watch?v=:", set(matches))
    matches2 = re.findall(r'"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"', html)
    print("Found video IDs in videoId:", set(matches2))
except Exception as e:
    print(e)
