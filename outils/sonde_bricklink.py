#!/usr/bin/env python3
"""Essai : le catalogue BrickLink (figurines M, sets S, objets G) peut-il se télécharger sans compte, depuis GitHub ?
Ne garde rien : affiche le code de réponse, la taille et les premières lignes."""
import urllib.request, urllib.parse, http.cookiejar

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"}
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def essai(nom, url, data=None):
    try:
        req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data else None, headers=UA)
        with op.open(req, timeout=60) as r:
            b = r.read()
            print(f"== {nom} : {r.status} {r.headers.get('Content-Type')} {len(b)} octets")
            t = b.decode("utf-8", "ignore")
            print("\n".join(t.splitlines()[:4])[:600])
    except Exception as e:
        print(f"== {nom} : ERREUR {e}")

essai("page de téléchargement", "https://www.bricklink.com/catalogDownload.asp")
for t in "MSG":
    essai(f"catalogue {t}", "https://www.bricklink.com/catalogDownload.asp?a=a",
          {"viewType": "0", "itemType": t, "selCatID": "", "selYear": "Y", "selWeight": "N", "selDim": "N", "itemNo": "", "downloadType": "T"})
essai("liste HTML des figurines", "https://www.bricklink.com/catalogList.asp?catType=M&pg=1")
essai("Rebrickable minifigs.csv.gz (en-tête)", "https://cdn.rebrickable.com/media/downloads/minifigs.csv.gz")
