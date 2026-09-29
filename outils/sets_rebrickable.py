#!/usr/bin/env python3
"""Catalogue des sets LEGO -> data/sets.tsv et data/sets_figurines.tsv

Source : fichiers publics et gratuits de Rebrickable (https://rebrickable.com/downloads/), mis à jour
chaque jour : sets.csv, themes.csv, inventories.csv, inventory_minifigs.csv, minifigs.csv.
Les numéros de sets sont les mêmes que chez BrickLink (ex. 75192-1).

- data/sets.tsv : code, nom, année, thème (chemin complet, ex. « Star Wars / Ultimate Collector Series »),
  nombre de pièces, nombre de figurines. Seulement les sets d'au moins une pièce (pas les livres ni
  les objets divers sans briques).
- data/sets_figurines.tsv : code du set, identifiant Rebrickable de la figurine (fig-…), quantité, nom,
  code BrickLink le plus probable et sa ressemblance (0 à 1). Rebrickable n'a pas les codes BrickLink
  des figurines : on les retrouve par le nom dans le catalogue BrickLink de l'appli (data/figurines.tsv),
  en préférant la même année et le même thème ; l'appli fait confirmer avant d'ajouter.

Rebrickable n'est pas joignable depuis l'environnement cloud de Claude : l'outil tourne sur GitHub
(.github/workflows/sets.yml), chaque mois et à la demande.
Utilisation : python3 outils/sets_rebrickable.py [dossier des .csv.gz déjà téléchargés]
"""
import csv, datetime, gzip, io, os, sys, urllib.request

SOURCE = "https://cdn.rebrickable.com/media/downloads/"
FICHIERS = ["sets", "themes", "inventories", "inventory_minifigs", "minifigs"]
RACINE = os.path.join(os.path.dirname(__file__), "..")
UA = {"User-Agent": "Mozilla/5.0 (catalogue personnel de collectionneur LEGO)"}


def lire_csv(nom, dossier):
    if dossier:
        with open(os.path.join(dossier, f"{nom}.csv.gz"), "rb") as f:
            brut = f.read()
    else:
        with urllib.request.urlopen(urllib.request.Request(SOURCE + f"{nom}.csv.gz", headers=UA), timeout=120) as r:
            brut = r.read()
    lignes = list(csv.DictReader(io.StringIO(gzip.decompress(brut).decode("utf-8"))))
    print(f"  {nom}.csv : {len(lignes)} lignes", file=sys.stderr)
    return lignes


def propre(t):
    return (t or "").replace("\t", " ").replace("\n", " ").strip()


# mots sans intérêt pour comparer les noms (dont la mention BrickLink des minifigs à collectionner
# « (Minifigure Only without Stand and Accessories) »)
MOTS_VIDES = {"the", "and", "with", "of", "a", "in", "minifigure", "minifig", "figure", "only", "without", "stand", "accessories"}


def mots(t):
    import re, unicodedata
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return {m for m in re.findall(r"[a-z0-9]+", t) if m not in MOTS_VIDES}


def base(nom):
    """Personnage : début du nom, avant la première virgule ou le premier tiret (« Snowtrooper »)"""
    import re
    return " ".join(sorted(mots(re.split(r",| - |\(", nom or "", maxsplit=1)[0])))


def catalogue_bricklink():
    """Figurines BrickLink de l'appli : [(code, mots du nom, année, racine de la catégorie, personnage)]"""
    res = []
    with open(os.path.join(RACINE, "data", "figurines.tsv"), encoding="utf-8") as f:
        for ligne in f:
            c = ligne.rstrip("\n").split("\t")
            if len(c) >= 3 and not ligne.startswith(("#", "code\t")):
                res.append((c[0], mots(c[1]), c[3] if len(c) > 3 else "", c[2].split(" / ")[0].lower(), base(c[1])))
    return res


def candidats(nom, annee, racine_theme, catalogue, index, n=6):
    """Codes BrickLink possibles pour une figurine Rebrickable, les plus ressemblants d'abord :
    [(ressemblance 0 à 1, code)]. Même personnage, même époque et même thème favorisés."""
    m, b = mots(nom), base(nom)
    if not m:
        return []
    possibles = set()
    for w in m:
        possibles |= index.get(w, set())
    res = []
    for i in possibles:
        code, mc, a, rc, bc = catalogue[i]
        commun = len(m & mc)
        # part des mots en commun, et part du nom Rebrickable retrouvée dans le nom BrickLink
        s = 0.25 * commun / len(m | mc) + 0.35 * commun / len(m)
        s += 0.25 if b and b == bc else 0
        if a and annee:
            ecart = abs(int(a) - int(annee))
            s += 0.15 if ecart == 0 else 0.08 if ecart == 1 else -0.2 if ecart > 3 else 0
        s += 0.1 if rc and racine_theme and rc == racine_theme else 0
        res.append((round(max(0.0, min(1.0, s)), 2), code))
    return sorted(res, reverse=True)[:n]


def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else None
    d = {nom: lire_csv(nom, dossier) for nom in FICHIERS}

    themes = {t["id"]: t for t in d["themes"]}
    def chemin(tid):
        noms = []
        while tid and tid in themes and len(noms) < 5:
            noms.insert(0, themes[tid]["name"]); tid = themes[tid]["parent_id"]
        return " / ".join(noms)

    # figurines de chaque set (dernière version de l'inventaire)
    derniere = {}
    for inv in d["inventories"]:
        if int(inv["version"]) >= int(derniere.get(inv["set_num"], {"version": 0})["version"]):
            derniere[inv["set_num"]] = inv
    inv_set = {inv["id"]: s for s, inv in derniere.items()}
    noms_figs = {m["fig_num"]: m["name"] for m in d["minifigs"]}
    figs = {}
    for l in d["inventory_minifigs"]:
        s = inv_set.get(l["inventory_id"])
        if s:
            figs.setdefault(s, []).append((l["fig_num"], int(l["quantity"])))

    sets = [s for s in d["sets"] if int(s.get("num_parts") or 0) > 0]
    date = datetime.date.today().isoformat()
    with open(os.path.join(RACINE, "data", "sets.tsv"), "w", encoding="utf-8") as f:
        f.write(f"#date {date}\ncode\tnom\tannee\ttheme\tpieces\tfigurines\n")
        for s in sorted(sets, key=lambda s: s["set_num"]):
            n = sum(q for _, q in figs.get(s["set_num"], []))
            f.write("\t".join([s["set_num"], propre(s["name"]), s["year"], propre(chemin(s["theme_id"])), s["num_parts"], str(n)]) + "\n")
    codes = {s["set_num"]: s for s in sets}
    catalogue = catalogue_bricklink()
    index = {}
    for i, (_, mc, _, _, _) in enumerate(catalogue):
        for w in mc:
            index.setdefault(w, set()).add(i)
    stats = []
    with open(os.path.join(RACINE, "data", "sets_figurines.tsv"), "w", encoding="utf-8") as f:
        f.write(f"#date {date}\nset\tfigurine\tquantite\tnom\tbricklink\tressemblance\n")
        for s in sorted(figs):
            if s not in codes:
                continue
            racine = chemin(codes[s]["theme_id"]).split(" / ")[0].lower()
            possibles = {fig: candidats(noms_figs.get(fig, ""), codes[s]["year"], racine, catalogue, index) for fig, _ in figs[s]}
            # un code BrickLink différent pour chaque figurine du set : les paires les plus sûres d'abord
            choix, pris = {}, set()
            for r, fig, code in sorted(((r, fig, c) for fig, l in possibles.items() for r, c in l), reverse=True):
                if fig not in choix and code not in pris:
                    choix[fig] = (code, r); pris.add(code)
            for fig, q in figs[s]:
                code, r = choix.get(fig, ("", 0.0))
                stats.append(r)
                f.write("\t".join([s, fig, str(q), propre(noms_figs.get(fig, "")), code, str(r)]) + "\n")
    bons = sum(1 for r in stats if r >= 0.7)
    print(f"{len(stats)} figurines de sets, {bons} rapprochées du catalogue BrickLink avec une ressemblance >= 0,7", file=sys.stderr)
    print(f"{len(sets)} sets, {sum(1 for s in figs if s in codes)} avec figurines -> data/sets.tsv, data/sets_figurines.tsv", file=sys.stderr)


if __name__ == "__main__":
    main()
