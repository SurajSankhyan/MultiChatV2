import urllib.request
import re

url = 'https://www.youtube.com/@surajsankhyanv7/live'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
try:
    resp = urllib.request.urlopen(req)
    html = resp.read().decode('utf-8')
    matches = re.findall(r'"liveStreamabilityRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"', html)
    print("Found video IDs in liveStreamabilityRenderer:", set(matches))
except Exception as e:
    print(e)
