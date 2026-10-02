#!/usr/bin/env python3
"""Essai : où mène le téléchargement du catalogue BrickLink sans compte (page de connexion LEGO), et cette page
utilise-t-elle un captcha ? Ne garde rien."""
import re, urllib.request, urllib.parse, http.cookiejar

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"}
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with op.open(urllib.request.Request("https://www.bricklink.com/catalogDownload.asp", headers=UA), timeout=60) as r:
    page = r.read().decode("utf-8", "ignore")
    print("adresse finale :", r.geturl()[:300])
for mot in ["captcha", "recaptcha", "hcaptcha", "arkose", "funcaptcha", "turnstile", "challenge", "password", "two-factor", "2fa", "verification"]:
    n = len(re.findall(mot, page, re.I))
    if n: print(f"  « {mot} » : {n} fois")
for s in re.findall(r'<script[^>]+src="([^"]+)"', page)[:15]:
    print("  script :", s[:150])
