#!/usr/bin/env python3
"""Codes-barres des boîtes LEGO (Brickset) -> data/codes_barres.tsv

Pour le scan d'une boîte en magasin dans l'appli (js/scan_boite.js) : le code-barres EAN (Europe) ou UPC (Amérique) lu
sur la boîte donne le numéro du set. Brickset (https://brickset.com) les donne pour chaque set dans son API v3 (champ
« barcode »), avec la clé gratuite déjà utilisée par outils/brickset_sorties.py (secret GitHub BRICKSET_KEY, jamais
écrit dans le dépôt ni affiché). Sans clé, l'outil ne fait rien.

Tous les sets depuis 1999 (environ 80 appels à l'API) ; relu une fois par mois seulement (le workflow tourne chaque
jour) : les sets à venir arrivent avec leur code-barres en général avant leur sortie. Une année en erreur garde ses
lignes précédentes.

Colonnes : code (« 75192-1 »), ean, upc.
Utilisation : BRICKSET_KEY=… python3 outils/brickset_codes_barres.py [--force]
"""
import datetime, json, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from brickset_sorties import appel

RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "data", "codes_barres.tsv")
PREMIERE_ANNEE = 1999
JOURS_VALIDITE = 30


def chiffres(t):
    return "".join(c for c in str(t or "") if c.isdigit())


def lire_ancien():
    """{code: (ean, upc)} et date du fichier existant"""
    anciens, date = {}, None
    if os.path.exists(SORTIE):
        for l in open(SORTIE, encoding="utf-8"):
            if l.startswith("#date "):
                date = l[6:].strip()
                continue
            c = l.rstrip("\n").split("\t")
            if len(c) >= 3 and c[0] != "code":
                anciens[c[0]] = (c[1], c[2])
    return anciens, date


def main():
    cle = os.environ.get("BRICKSET_KEY", "").strip()
    if not cle:
        print("Pas de clé Brickset (BRICKSET_KEY) : rien à faire.", file=sys.stderr)
        return
    anciens, date = lire_ancien()
    aujourdhui = datetime.date.today()
    if date and "--force" not in sys.argv and (aujourdhui - datetime.date.fromisoformat(date)).days < JOURS_VALIDITE:
        print(f"Codes-barres relevés le {date} : relus dans {JOURS_VALIDITE} jours.", file=sys.stderr)
        return
    appel("checkKey", cle)
    codes = dict(anciens)
    for annee in range(PREMIERE_ANNEE, aujourdhui.year + 2):
        page = 1
        try:
            while True:
                rep = appel("getSets", cle, userHash="", params=json.dumps({"year": str(annee), "pageSize": 500, "pageNumber": page,
                                                                             "extendedData": 0}))
                lot = rep.get("sets") or []
                for s in lot:
                    b = s.get("barcode") or {}
                    ean, upc = chiffres(b.get("EAN")), chiffres(b.get("UPC"))
                    if ean or upc:
                        codes[f"{s.get('number')}-{s.get('numberVariant') or 1}"] = (ean, upc)
                print(f"  {annee}, page {page} : {len(lot)} sets", file=sys.stderr)
                if len(lot) < 500:
                    break
                page += 1
        except Exception as e:  # limite de l'API atteinte, Brickset indisponible… : lignes précédentes gardées
            print(f"  {annee} : {e}", file=sys.stderr)
            if "limit" in str(e).lower():
                break
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\ncode\tean\tupc\n")
        for code in sorted(codes):
            f.write(f"{code}\t{codes[code][0]}\t{codes[code][1]}\n")
    print(f"{len(codes)} sets avec un code-barres -> data/codes_barres.tsv", file=sys.stderr)


if __name__ == "__main__":
    main()
