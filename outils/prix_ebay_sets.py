#!/usr/bin/env python3
"""Prix demandés sur eBay.de pour des sets LEGO vendus SANS leurs figurines -> fichier TSV.

Sert à estimer le « reste du set » (briques, boîte, notice) d'un set monté dont les figurines sont estimées à part
(js/valeur.js). Pour chaque set : recherches « LEGO <n°> ohne Figuren » et « … ohne Minifiguren » (API Browse,
outils/ebay.py) ; annonces à prix fixe dont le titre contient le numéro du set et « ohne (Mini)Figuren », sans autre
numéro de set (lots), ni copie en briques compatibles, kit d'éclairage, plaque, set incomplet… Prix du milieu, plus
bas et plus haut, sans le port. Ce sont des prix DEMANDÉS : l'appli n'en retient que 85 %, et seulement à partir de
2 annonces.

Test du 30/09/2026 sur 57 sets : demandé sans figurines = 62 % du prix LEGO (médiane ; moitié centrale 48-74 %),
contre 30 % retenus jusque-là par l'appli.

Utilisation : python3 outils/prix_ebay_sets.py codes.txt sortie.tsv   (lignes « SET 75192-1 » ou « 75192-1 »)
"""
import datetime, os, re, statistics, sys, time

sys.path.insert(0, os.path.dirname(__file__))
import ebay

EXCLUS = re.compile(r"klemmbaust|upgrade|\bkit\b|kompatib|plakette|beleucht|licht|\bled\b|display|vitrine|\bnur\b|only|moc|"
                    r"ständer|\bstand\b|sticker|aufkleber|ersatz|konvolut|sammlung\s*x|\b\d+\s*x\b|\bsets\b|nicht komplett|"
                    r"teil fehlt|fast vollst|unvollst", re.I)


def relever(code):
    num = code.split("-")[0]
    annonces = {}
    for q in (f"LEGO {num} ohne Figuren", f"LEGO {num} ohne Minifiguren"):
        try:
            d = ebay.rechercher(q, 50)
        except Exception as e:
            print(f"{code} : erreur {e}", file=sys.stderr)
            continue
        for a in d.get("itemSummaries", []):
            t = a.get("title", "")
            autres = set(re.findall(r"\b\d{4,5}\b", t)) - {num}
            if (num in t and re.search(r"ohne\s+(die\s+)?(mini)?fig", t, re.I) and not autres and not EXCLUS.search(t)
                    and "FIXED_PRICE" in (a.get("buyingOptions") or []) and (a.get("price") or {}).get("currency") == "EUR"):
                annonces[a.get("itemId")] = float(a["price"]["value"])
        time.sleep(0.2)
    return sorted(annonces.values())


def main():
    entree, sortie = sys.argv[1], sys.argv[2]
    codes = [l.split()[-1] for l in open(entree, encoding="utf-8") if re.match(r"^(SET\s+)?\d", l.strip())]
    jour = datetime.date.today().isoformat()
    lignes = ["code\tannonces\tprix_min\tprix_median\tprix_max\tdate"]
    trouves = 0
    for i, code in enumerate(codes, 1):
        p = relever(code)
        if p:
            trouves += 1
            lignes.append(f"{code}\t{len(p)}\t{p[0]:.2f}\t{statistics.median(p):.2f}\t{p[-1]:.2f}\t{jour}")
        if i % 20 == 0:
            print(f"{i}/{len(codes)} ({trouves} avec annonces)", file=sys.stderr)
    open(sortie, "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print(f"{trouves} sets sur {len(codes)} ont des annonces sans figurines -> {sortie}", file=sys.stderr)


if __name__ == "__main__":
    main()
