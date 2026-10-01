#!/usr/bin/env python3
"""Sorties LEGO avec leur date (Brickset) -> data/sorties.tsv

Brickset (https://brickset.com) donne pour chaque set sa date de sortie (launchDate), sa date de fin, son thème et
sous-thème, ses pièces et son nombre de figurines. (Son prix en euros est celui de LEGO Allemagne : pas gardé,
l'appli affiche les prix français, outils/prix_lego_fr.py.) Rebrickable (outils/nouveautes_rebrickable.py)
ne donne que l'année : l'appli s'en sert pour classer les nouveautés par mois de sortie.

Accès officiel par l'API v3 de Brickset, avec une clé gratuite : variable d'environnement BRICKSET_KEY (secret GitHub
du même nom, jamais écrit dans le dépôt ni affiché). Sans clé, l'outil ne fait rien.
Sets de l'année et de la suivante (déjà annoncés) ; de janvier à mars, aussi ceux de l'an dernier.

Colonnes : code (« 75412-1 »), nom, thème, sous-thème, année, sortie (AAAA-MM-JJ), fin, pièces, figurines, image.
Utilisation : BRICKSET_KEY=… python3 outils/brickset_sorties.py
"""
import datetime, json, os, sys, urllib.parse, urllib.request

RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "data", "sorties.tsv")
API = "https://brickset.com/api/v3.asmx/"
UA = {"User-Agent": "Mozilla/5.0 (catalogue personnel de collectionneur LEGO)"}


def appel(methode, cle, **params):
    corps = urllib.parse.urlencode({"apiKey": cle, **params}).encode()
    req = urllib.request.Request(API + methode, data=corps, headers={**UA, "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=60) as r:
        rep = json.loads(r.read().decode("utf-8"))
    if rep.get("status") != "success":
        raise RuntimeError(f"Brickset ({methode}) : {rep.get('message') or rep.get('status')}")
    return rep


def propre(t):
    return str(t if t is not None else "").replace("\t", " ").replace("\n", " ").strip()


def jour(t):
    return (t or "")[:10]


def main():
    cle = os.environ.get("BRICKSET_KEY", "").strip()
    if not cle:
        print("Pas de clé Brickset (BRICKSET_KEY) : rien à faire.", file=sys.stderr)
        return
    appel("checkKey", cle)
    aujourdhui = datetime.date.today()
    annees = [aujourdhui.year, aujourdhui.year + 1] + ([aujourdhui.year - 1] if aujourdhui.month <= 3 else [])
    sets = []
    for annee in annees:
        page = 1
        while True:
            rep = appel("getSets", cle, userHash="", params=json.dumps({"year": str(annee), "pageSize": 500, "pageNumber": page,
                                                                         "extendedData": 0}))
            lot = rep.get("sets") or []
            sets += lot
            print(f"  {annee}, page {page} : {len(lot)} sets (sur {rep.get('matches')})", file=sys.stderr)
            if len(lot) < 500:
                break
            page += 1
    lignes = []
    for s in sets:
        code = f"{s.get('number')}-{s.get('numberVariant') or 1}"
        lignes.append([code, propre(s.get("name")), propre(s.get("theme")), propre(s.get("subtheme")), propre(s.get("year")),
                       jour(s.get("launchDate")), jour(s.get("exitDate")), propre(s.get("pieces") or ""), propre(s.get("minifigs") or ""),
                       propre((s.get("image") or {}).get("imageURL"))])
    lignes.sort(key=lambda l: (l[5] or "9999", l[2], l[0]))
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\ncode\tnom\ttheme\tsous_theme\tannee\tsortie\tfin\tpieces\tfigurines\timage\n")
        for l in lignes:
            f.write("\t".join(l) + "\n")
    avec = sum(1 for l in lignes if l[5])
    print(f"{len(lignes)} sets ({avec} avec une date de sortie) -> data/sorties.tsv", file=sys.stderr)
    # aperçu : sorties du mois en cours, et thèmes qui ressemblent aux BAM (Build a Minifigure)
    mois = aujourdhui.isoformat()[:7]
    for l in [l for l in lignes if l[5].startswith(mois)][:30]:
        print(f"  {l[5]} {l[2]} / {l[3]} : {l[0]} {l[1]}", file=sys.stderr)
    bam = sorted({f"{l[2]} / {l[3]}" for l in lignes if "minifig" in (l[2] + l[3] + l[1]).lower() and "collectible" not in l[2].lower()})
    print("Thèmes « minifig » (BAM ?) :", bam[:20], file=sys.stderr)


if __name__ == "__main__":
    main()
