#!/usr/bin/env python3
"""Essai : où se trouve le prix public français sur Avenue de la Brique (fiche d'un set, page « Tous les LEGO de 2026 »).
Affiche les passages qui parlent de prix. Ne garde rien."""
import re, urllib.error, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}


def lire(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""


def texte(p, a, b):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", p[max(0, a):b])).strip()


for url in ["https://www.avenuedelabrique.com/lego-star-wars/75457-le-super-destroyer-stellaire-de-classe-executor-ucs/p12717",
            "https://www.avenuedelabrique.com/lego-marvel-super-heroes/76347-avengers-doomsday-le-quinjet/p12403"]:
    st, p = lire(url)
    print(url, "->", st, len(p))
    for m in list(re.finditer(r"(?i)prix public|prix lego|prix conseill|itemprop=\"price\"|\"price\"|lego\.com|shop\.lego", p))[:10]:
        print("   …", texte(p, m.start() - 200, m.end() + 200)[:380])
        print("   [html]", re.sub(r"\s+", " ", p[max(0, m.start() - 150):m.end() + 150])[:300])
st, p = lire("https://www.avenuedelabrique.com/lego-2026")
print("lego-2026 ->", st, len(p))
print("liens de pages :", sorted(set(re.findall(r'href="([^"]*lego-2026[^"]*)"', p)))[:10])
for m in list(re.finditer(r"€", p))[:8]:
    print("   …", texte(p, m.start() - 250, m.end() + 40)[:300])
    print("   [html]", re.sub(r"\s+", " ", p[max(0, m.start() - 300):m.end() + 60])[:380])
