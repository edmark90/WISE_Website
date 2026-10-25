import urllib.request, json

url = "https://nominatim.openstreetmap.org/search?q=Pagkakaisa+Muntinlupa&format=json&limit=5"
req = urllib.request.Request(url, headers={"User-Agent": "WISE-Muntinlupa-Audit/1.0"})
try:
    with urllib.request.urlopen(req) as resp:
        results = json.loads(resp.read().decode())
        for r in results:
            print(r.get("display_name"), r.get("lat"), r.get("lon"))
except Exception as e:
    print("Error:", e)
