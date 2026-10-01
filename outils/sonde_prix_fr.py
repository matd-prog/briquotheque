#!/usr/bin/env python3
"""Essai : comment lire le prix public français d'un set sur Avenue de la Brique (comparateur de prix français).
Affiche la structure des pages (formulaire de recherche, adresses des fiches, passages sur les prix). Ne garde rien."""
import re, sys, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}
BASE = "https://www.avenuedelabrique.com/"


def lire(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            return r.status, r.geturl(), r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:
        return 0, url, str(e)


def texte(p, a, b):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", p[max(0, a):b])).strip()


s, f, accueil = lire(BASE)
print("formulaires :", re.findall(r"<form[^>]*>", accueil)[:5])
print("champs :", sorted(set(re.findall(r'<input[^>]+name="([^"]+)"', accueil)))[:20])
liens = sorted(set(re.findall(r'href="(/[^"#?]*\d{4,6}[^"#?]*)"', accueil)))
print("fiches (exemples) :", liens[:12])
for numero in ["75457", "76347"]:
    for url in [BASE + f"recherche?recherche={numero}", BASE + f"recherche?s={numero}", BASE + f"recherche?q={numero}&type=set",
                BASE + f"recherche/{numero}", BASE + f"lego-{numero}"]:
        st, fi, p = lire(url)
        l = sorted(set(re.findall(r'href="([^"]*' + numero + r'[^"]*)"', p)))[:5]
        print(f"{numero} {url} -> {st} {fi} ({len(p)} car.) {l}")
if liens:
    st, fi, p = lire(urllib.parse.urljoin(BASE, liens[0]))
    print("fiche", liens[0], "->", st, len(p))
    for m in list(re.finditer(r"(?i)prix public|prix lego|prix conseill|\"price\"|itemprop=\"price\"", p))[:8]:
        print("   …", texte(p, m.start() - 160, m.end() + 160)[:320])
    print("   ld+json :", re.findall(r'application/ld\+json[^>]*>(.{0,600})', p, re.S)[:1])
