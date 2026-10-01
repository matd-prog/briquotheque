#!/usr/bin/env python3
"""Nouveautés LEGO (sets, figurines, objets dérivés) -> data/nouveautes.tsv

Source : fichiers publics et gratuits de Rebrickable (mis à jour chaque jour), les mêmes que
outils/sets_rebrickable.py. Les sorties y apparaissent en général avant leur arrivée en magasin.

Rebrickable ne donne que l'année de sortie : la date à laquelle un article est apparu pour la
première fois (« vu le ») est gardée d'un passage à l'autre dans data/nouveautes.tsv. Au premier
passage, les articles déjà présents n'ont pas de date.

Gardés : les articles de cette année et des suivantes (déjà annoncés) ; de janvier à mars, aussi ceux
de l'an dernier ; et tout article apparu depuis moins d'un an.

Colonnes : type (set, figurine, objet), code Rebrickable, code BrickLink (sets et objets : le même
numéro ; figurines : le plus ressemblant du catalogue de l'appli, vide si pas assez sûr), ressemblance,
nom, thème, année, photo, vu le, sets (figurines : les sets qui la contiennent).

L'appli s'en sert pour reconnaître les nouveautés que Brickognize ne connaît pas encore (avec les
empreintes de outils/empreintes_nouveautes.js) et pour les proposer dans la recherche.

Utilisation : python3 outils/nouveautes_rebrickable.py [dossier des .csv.gz déjà téléchargés]
"""
import datetime, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from sets_rebrickable import FICHIERS, RACINE, candidats, catalogue_bricklink, lire_csv, propre  # noqa: E402

SORTIE = os.path.join(RACINE, "data", "nouveautes.tsv")
COLONNES = ["type", "code", "bricklink", "ressemblance", "nom", "theme", "annee", "image", "vu_le", "sets"]
SEUIL_BRICKLINK = 0.7       # en dessous, le code BrickLink n'est pas proposé (risque de confondre avec une figurine plus ancienne)
RACINES_OBJETS = {"gear", "key chain", "key chains", "magnets", "clocks and watches"}
RACINES_EXCLUES = {"books", "supplemental", "service packs", "bulk bricks"}


def anciennes():
    """Lignes du passage précédent : code -> dict"""
    res = {}
    if os.path.exists(SORTIE):
        with open(SORTIE, encoding="utf-8") as f:
            for ligne in f:
                c = ligne.rstrip("\n").split("\t")
                if ligne.startswith("#") or c[0] == "type" or len(c) < len(COLONNES):
                    continue
                res[c[1]] = dict(zip(COLONNES, c))
    return res


def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else None
    d = {nom: lire_csv(nom, dossier) for nom in FICHIERS}
    aujourdhui = datetime.date.today()
    premier = not os.path.exists(SORTIE)
    avant = anciennes()

    annee_min = aujourdhui.year - (1 if aujourdhui.month <= 3 else 0)
    il_y_a_un_an = (aujourdhui - datetime.timedelta(days=365)).isoformat()

    themes = {t["id"]: t for t in d["themes"]}
    def chemin(tid):
        noms = []
        while tid and tid in themes and len(noms) < 5:
            noms.insert(0, themes[tid]["name"]); tid = themes[tid]["parent_id"]
        return " / ".join(noms)

    def garder(code, annee):
        vu = avant.get(code, {}).get("vu_le", "")
        if annee and annee.isdigit() and int(annee) >= annee_min:
            return True
        return bool(vu) and vu >= il_y_a_un_an

    def date_vue(code):
        if code in avant:
            return avant[code]["vu_le"]
        return "" if premier else aujourdhui.isoformat()

    lignes = []

    # sets et objets dérivés
    sets = {s["set_num"]: s for s in d["sets"]}
    for s in d["sets"]:
        racine = chemin(s["theme_id"]).split(" / ")[0].lower()
        if racine in RACINES_EXCLUES or not garder(s["set_num"], s["year"]):
            continue
        objet = racine in RACINES_OBJETS or "key chain" in chemin(s["theme_id"]).lower() or int(s.get("num_parts") or 0) == 0
        bl = s["set_num"][:-2] if objet and s["set_num"].endswith("-1") else s["set_num"]
        lignes.append({"type": "objet" if objet else "set", "code": s["set_num"], "bricklink": bl, "ressemblance": "",
                       "nom": propre(s["name"]), "theme": propre(chemin(s["theme_id"])), "annee": s["year"],
                       "image": s.get("img_url", ""), "vu_le": date_vue(s["set_num"]), "sets": ""})

    # figurines : année = celle du premier set qui la contient
    derniere = {}
    for inv in d["inventories"]:
        if int(inv["version"]) >= int(derniere.get(inv["set_num"], {"version": 0})["version"]):
            derniere[inv["set_num"]] = inv
    inv_set = {inv["id"]: s for s, inv in derniere.items()}
    contenue = {}
    for l in d["inventory_minifigs"]:
        s = inv_set.get(l["inventory_id"])
        if s in sets:
            contenue.setdefault(l["fig_num"], []).append(sets[s])

    catalogue = catalogue_bricklink()
    index = {}
    for i, (_, mc, _, _, _) in enumerate(catalogue):
        for w in mc:
            index.setdefault(w, set()).add(i)

    for m in d["minifigs"]:
        dans = sorted(contenue.get(m["fig_num"], []), key=lambda s: (s["year"], s["set_num"]))
        if not dans:
            continue
        premier_set = dans[0]
        annee = premier_set["year"]
        if not garder(m["fig_num"], annee):
            continue
        theme = chemin(premier_set["theme_id"])
        poss = candidats(m["name"], annee, theme.split(" / ")[0].lower(), catalogue, index, n=1)
        r, code = poss[0] if poss else (0.0, "")
        lignes.append({"type": "figurine", "code": m["fig_num"], "bricklink": code if r >= SEUIL_BRICKLINK else "",
                       "ressemblance": str(r), "nom": propre(m["name"]), "theme": propre(theme), "annee": annee,
                       "image": m.get("img_url", ""), "vu_le": date_vue(m["fig_num"]),
                       "sets": " ".join(s["set_num"] for s in dans[:4])})

    ordre = {"figurine": 0, "objet": 1, "set": 2}
    lignes.sort(key=lambda l: (l["vu_le"], l["annee"], l["code"]), reverse=True)  # les plus récentes d'abord
    lignes.sort(key=lambda l: ordre[l["type"]])
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\n" + "\t".join(COLONNES) + "\n")
        for l in lignes:
            f.write("\t".join(l[c] for c in COLONNES) + "\n")

    compte = {t: sum(1 for l in lignes if l["type"] == t) for t in ordre}
    neufs = [l for l in lignes if l["vu_le"] == aujourdhui.isoformat()]
    print(f"{len(lignes)} nouveautés ({compte['figurine']} figurines, {compte['set']} sets, {compte['objet']} objets dérivés), "
          f"dont {len(neufs)} apparues aujourd'hui -> data/nouveautes.tsv", file=sys.stderr)
    for l in neufs[:40]:
        print(f"  + {l['type']} {l['code']} {l['nom']}", file=sys.stderr)


if __name__ == "__main__":
    main()
