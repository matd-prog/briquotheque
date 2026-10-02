#!/usr/bin/env python3
"""Prix demandés sur eBay France pour les articles d'autres marques que LEGO (Cobi, BlueBrixx, CaDA…) -> fichier TSV.

Ces marques ne sont ni sur BrickLink ni chez Rebrickable : leur valeur est estimée d'après les annonces eBay.fr
(API Browse, outils/ebay.py, place de marché EBAY_FR). Pour chaque article : recherche « <marque> <numéro> » ;
annonces à prix fixe, en euros, dont le titre contient la marque et le numéro (pas un morceau d'un autre nombre ; « COB2661 »
accepté pour 2661), sans lot, ni notice seule, boîte vide, kit d'éclairage,
pièces détachées… Prix le plus bas, du milieu et le plus haut, sans le port. Ce sont des prix DEMANDÉS : l'appli
(js/valeur.js) en prend le prix du milieu comme coût de rachat, 85 % pour l'occasion, et seulement à partir de
2 annonces ; sinon le prix payé indiqué.

Entrée : la sauvegarde de la collection (sauvegarde/collection.json du dépôt privé : sets dont la colonne « Marque »
n'est pas LEGO), ou un fichier TSV « marque<TAB>numéro » (une ligne par article).
Utilisation : python3 outils/prix_ebay_marques.py collection.json prix_ebay_marques.tsv
"""
import datetime, json, os, re, statistics, sys, time, unicodedata

sys.path.insert(0, os.path.dirname(__file__))
import ebay

EXCLUS = re.compile(r"\bnotice\b|instructions? seule|seulement (la )?notice|bo[iî]te vide|emballage vide|\bvide\b|"
                    r"kit (d.)?(é|e)clairage|\bled\b|lumi[eè]re|lighting|vitrine|display|support|pi[eè]ces? d[ée]tach|"
                    r"\blot\b|\blots\b|\b\d+\s*x\b|\bx\s*\d+\b|collection de|ensemble de|stickers?|autocollants?|"
                    r"incomplet|manque|sans figurine|pour pi[eè]ces", re.I)


def sans_accents(t):
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower()


def articles(entree):
    """[(marque, numéro)] des articles d'autres marques, sans doublon"""
    res = []
    if entree.endswith(".json"):
        base = json.load(open(entree, encoding="utf-8")).get("base", [])
        for e in base:
            if e.get("table") != "Sets":
                continue
            ch = e.get("champs", {})
            marque, code = str(ch.get("Marque", "")).strip(), str(ch.get("Numéro", "")).strip()
            if marque and marque.lower() != "lego" and code:
                res.append((marque, code))
    else:
        for l in open(entree, encoding="utf-8"):
            p = l.rstrip("\n").split("\t")
            if len(p) >= 2 and p[0].strip() and p[1].strip() and p[0].lower() != "marque":
                res.append((p[0].strip(), p[1].strip()))
    return list(dict.fromkeys(res))


def relever(marque, code):
    m = sans_accents(marque)
    num = re.escape(code.lower())
    annonces = {}
    try:
        d = ebay.rechercher(f"{marque} {code}", 50, marche="EBAY_FR")
    except Exception as e:
        print(f"{marque} {code} : erreur {e}", file=sys.stderr)
        return []
    for a in d.get("itemSummaries", []):
        t = sans_accents(a.get("title", ""))
        if m.replace(" ", "") not in t.replace(" ", "") or not re.search(rf"(?<![0-9]){num}(?![0-9])", t):
            continue
        if EXCLUS.search(t):
            continue
        prix = a.get("price") or {}
        if "FIXED_PRICE" in (a.get("buyingOptions") or []) and prix.get("currency") == "EUR":
            annonces[a.get("itemId")] = float(prix["value"])
    time.sleep(0.2)
    return sorted(annonces.values())


def main():
    entree, sortie = sys.argv[1], sys.argv[2]
    liste = articles(entree)
    jour = datetime.date.today().isoformat()
    lignes = ["marque\tcode\tannonces\tprix_min\tprix_median\tprix_max\tdate"]
    trouves = 0
    for marque, code in liste:
        p = relever(marque, code)
        if p:
            trouves += 1
            lignes.append(f"{marque}\t{code}\t{len(p)}\t{p[0]:.2f}\t{statistics.median(p):.2f}\t{p[-1]:.2f}\t{jour}")
        print(f"{marque} {code} : {len(p)} annonce(s)" + (f", milieu {statistics.median(p):.2f} €" if p else ""), file=sys.stderr)
    open(sortie, "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print(f"{trouves} article(s) sur {len(liste)} ont des annonces eBay France -> {sortie}", file=sys.stderr)


if __name__ == "__main__":
    main()
