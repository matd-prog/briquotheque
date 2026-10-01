#!/usr/bin/env python3
"""Essai : texte visible d'une fiche Avenue de la Brique, pour repérer le prix public français. Ne garde rien."""
import html, re, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}
url = "https://www.avenuedelabrique.com/lego-marvel-super-heroes/76347-avengers-doomsday-le-quinjet/p12403"
with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
    p = r.read().decode("utf-8", "ignore")
corps = p[p.find("<body"):]
corps = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", " ", corps)
t = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", corps)))
t = re.sub(r"(\s*\|\s*)+", " | ", t)
print(t[:4500])
print("----- montants :")
for m in list(re.finditer(r"\d+[,.]\d{2}\s*€|€\s*\d+[,.]\d{2}|\d+\s*€", t))[:15]:
    print("   …", t[max(0, m.start() - 90):m.end() + 30])
print("----- html autour du premier montant :")
m = re.search(r"\d+(?:[,.]\d{2})?\s*(?:&euro;|€)", p)
if m:
    print(re.sub(r"\s+", " ", p[max(0, m.start() - 700):m.end() + 200]))
