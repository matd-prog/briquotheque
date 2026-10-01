#!/usr/bin/env python3
"""Essai : comment lire le prix public français d'un set sur Avenue de la Brique (comparateur de prix français).
Affiche, pour quelques sets, l'adresse trouvée et les passages de la page qui parlent de prix. Ne garde rien."""
import re, sys, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}


def lire(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return r.status, r.geturl(), r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:
        return 0, url, str(e)


for numero in ["75457", "76347", "21371"]:
    for url in [f"https://www.avenuedelabrique.com/recherche?q={numero}", f"https://www.avenuedelabrique.com/search?q={numero}",
                f"https://www.avenuedelabrique.com/lego/{numero}", f"https://www.avenuedelabrique.com/{numero}"]:
        statut, finale, page = lire(url)
        print(f"{numero} {url} -> {statut} {finale} ({len(page)} car.)")
        if statut != 200:
            continue
        liens = sorted(set(re.findall(r'href="([^"]*' + numero + r'[^"]*)"', page)))[:8]
        print("   liens :", liens)
        for m in list(re.finditer(r"(?i)prix public|prix lego|€|ld\+json", page))[:6]:
            print("   …", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page[max(0, m.start() - 120):m.end() + 120])).strip()[:240])
        if liens:
            l = urllib.parse.urljoin(finale, liens[0])
            s2, f2, p2 = lire(l)
            print(f"   fiche {l} -> {s2} ({len(p2)} car.)")
            for m in list(re.finditer(r"(?i)prix public|prix lego|\"price\"", p2))[:6]:
                print("     …", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", p2[max(0, m.start() - 150):m.end() + 150])).strip()[:300])
        break
for url in ["https://www.hothbricks.com/", "https://www.avenuedelabrique.com/"]:
    s, f, p = lire(url)
    print(url, "->", s, len(p))
