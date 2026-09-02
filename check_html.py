import urllib.request

url = 'https://www.youtube.com/@surajsankhyanv7/live'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    resp = urllib.request.urlopen(req)
    html = resp.read().decode('utf-8')
    if '1X3-MSfw_AE' in html:
        print("YES! 1X3-MSfw_AE is in the HTML!")
    else:
        print("No, it's not in the HTML.")
except Exception as e:
    print(e)
