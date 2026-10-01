#!/usr/bin/env python3
"""Prix public LEGO en France (lego.com/fr-fr) des sets récents et à venir -> data/prix_fr.tsv

Choix de l'utilisateur (01/10/2026) : tous les prix affichés sont des prix français ; seuls ceux de JB Spielwaren
restent allemands. Brickset (outils/brickset_sorties.py) ne donne que le prix LEGO allemand.

Lit la page produit du site LEGO France de chaque set sorti depuis 60 jours ou à venir (data/sorties.tsv), et y prend
le prix (données « schema.org » de la page : offers.price, en EUR). Une page toutes les 2 secondes, 200 au plus par
passage ; un prix relevé depuis moins de 7 jours n'est pas relu. Si le site LEGO refuse la lecture, rien n'est inventé :
l'appli n'affiche alors pas de prix.

Colonnes : code, prix (€), disponibilité (texte LEGO), date du relevé.
Utilisation : python3 outils/prix_lego_fr.py
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.request

RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "data", "prix_fr.tsv")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}


def lire_tsv(chemin):
    if not os.path.exists(chemin):
        return []
    with open(chemin, encoding="utf-8") as f:
        lignes = [l.rstrip("\n").split("\t") for l in f if not l.startswith("#")]
    return [dict(zip(lignes[0], l)) for l in lignes[1:]] if lignes else []


def prix_page(numero):
    req = urllib.request.Request(f"https://www.lego.com/fr-fr/product/{numero}", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        page = r.read().decode("utf-8", "ignore")
    for bloc in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        try:
            d = json.loads(bloc)
        except ValueError:
            continue
        for x in (d if isinstance(d, list) else [d]):
            offres = x.get("offers") if isinstance(x, dict) else None
            if isinstance(offres, list):
                offres = offres[0] if offres else None
            if isinstance(offres, dict) and offres.get("price") and offres.get("priceCurrency", "EUR") == "EUR":
                return float(offres["price"]), str(offres.get("availability", "")).rsplit("/", 1)[-1]
    m = re.search(r'"price"\s*:\s*\{[^}]*"centAmount"\s*:\s*(\d+)', page)
    if m:
        return int(m.group(1)) / 100, ""
    return None, ""


def main():
    aujourdhui = datetime.date.today()
    debut = (aujourdhui - datetime.timedelta(days=60)).isoformat()
    sets = [s for s in lire_tsv(os.path.join(RACINE, "data", "sorties.tsv")) if s.get("sortie", "") >= debut or not s.get("sortie")]
    deja = {p["code"]: p for p in lire_tsv(SORTIE)}
    recent = (aujourdhui - datetime.timedelta(days=7)).isoformat()
    a_lire = [s["code"] for s in sets if not (s["code"] in deja and deja[s["code"]].get("date", "") >= recent)][:200]
    trouves = refus = 0
    for i, code in enumerate(a_lire):
        numero = code.split("-")[0]
        try:
            prix, dispo = prix_page(numero)
        except urllib.error.HTTPError as e:
            refus += 1
            print(f"  {code} : le site LEGO a répondu {e.code}", file=sys.stderr)
            if refus >= 5 and not trouves:
                print("Le site LEGO refuse la lecture depuis ce serveur : arrêt.", file=sys.stderr)
                break
            continue
        except Exception as e:
            print(f"  {code} : {e}", file=sys.stderr)
            continue
        if prix:
            deja[code] = {"code": code, "prix": f"{prix:.2f}", "disponibilite": dispo, "date": aujourdhui.isoformat()}
            trouves += 1
            if trouves <= 5:
                print(f"  {code} : {prix:.2f} € ({dispo})", file=sys.stderr)
        time.sleep(2)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\ncode\tprix\tdisponibilite\tdate\n")
        for p in sorted(deja.values(), key=lambda p: p["code"]):
            f.write("\t".join([p["code"], p["prix"], p.get("disponibilite", ""), p["date"]]) + "\n")
    print(f"{trouves} prix français relevés sur {len(a_lire)} pages ({len(deja)} au total) -> data/prix_fr.tsv", file=sys.stderr)


if __name__ == "__main__":
    main()
