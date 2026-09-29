#!/usr/bin/env python3
"""Recherche d'annonces eBay (API officielle « Browse »), pour trouver des blisters JB Spielwaren.

Clés lues dans les variables d'environnement EBAY_CLIENT_ID et EBAY_CLIENT_SECRET (réglages de
l'environnement cloud, jamais dans le code ni sur GitHub). Rien n'est affiché des clés.

Utilisation : python3 outils/ebay.py "JB Spielwaren custom" [nombre]   (eBay.de par défaut)
"""
import base64, json, os, ssl, sys, urllib.parse, urllib.request

JETON = "https://api.ebay.com/identity/v1/oauth2/token"
RECHERCHE = "https://api.ebay.com/buy/browse/v1/item_summary/search"


def contexte_ssl():
    for f in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if f and os.path.exists(f):
            return ssl.create_default_context(cafile=f)
    return ssl.create_default_context()


CTX = contexte_ssl()


def jeton():
    ident, secret = os.environ.get("EBAY_CLIENT_ID"), os.environ.get("EBAY_CLIENT_SECRET")
    if not ident or not secret:
        sys.exit("Clés eBay absentes : EBAY_CLIENT_ID et EBAY_CLIENT_SECRET (nouvelle session nécessaire).")
    corps = urllib.parse.urlencode({"grant_type": "client_credentials",
                                    "scope": "https://api.ebay.com/oauth/api_scope"}).encode()
    req = urllib.request.Request(JETON, data=corps, headers={
        "Authorization": "Basic " + base64.b64encode(f"{ident.strip()}:{secret.strip()}".encode()).decode(),
        "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
            return json.load(r)["access_token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"eBay refuse les clés ({e.code}) : {e.read().decode()[:300]}")


def rechercher(texte, nombre=20, marche="EBAY_DE", decalage=0):
    url = RECHERCHE + "?" + urllib.parse.urlencode({"q": texte, "limit": nombre, "offset": decalage})
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + jeton(), "X-EBAY-C-MARKETPLACE-ID": marche})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        return json.load(r)


if __name__ == "__main__":
    texte = sys.argv[1] if len(sys.argv) > 1 else "JB Spielwaren custom"
    d = rechercher(texte, int(sys.argv[2]) if len(sys.argv) > 2 else 10)
    print(f"{d.get('total', 0)} annonces pour « {texte} » sur eBay.de")
    for a in d.get("itemSummaries", []):
        print(" -", a.get("title"), "|", (a.get("image") or {}).get("imageUrl", ""))
