#!/usr/bin/env python3
"""Prix demandés sur eBay.de pour des figurines JB Spielwaren -> fichier TSV (prix de revente pratiqués).

Pour chaque nom de figurine (un par ligne dans le fichier d'entrée), cherche « JB Spielwaren <nom> » sur
eBay.de avec l'API officielle « Browse » (outils/ebay.py, clés EBAY_CLIENT_ID / EBAY_CLIENT_SECRET), garde
les annonces à prix fixe dont le titre contient le nom (tous les mots de 3 lettres et plus, une lettre
d'écart tolérée pour les mots longs), écarte les lots (« Konvolut », « Sammlung », « x2 »…), puis calcule
le prix le plus bas, le prix du milieu (médiane) et le plus haut, sans le port, et le port habituel.

Ce sont des prix DEMANDÉS (annonces en cours), pas des ventes conclues : eBay ne donne pas les ventes
conclues par cette API. Un prix demandé est souvent plus haut que le prix auquel l'objet se vend.

Utilisation : python3 outils/prix_ebay_jb.py noms.txt sortie.tsv
"""
import datetime, re, statistics, sys, time, unicodedata, os

sys.path.insert(0, os.path.dirname(__file__))
import ebay

IGNORES = {"custom", "minifigure", "minifigur", "minifig", "figur", "figure", "the", "and", "with", "von", "der", "die",
           "das", "jb", "spielwaren", "lego", "neu", "new", "limited", "exklusive", "exclusive", "stream", "edition", "of"}
LOTS = re.compile(r"konvolut|sammlung|\blot\b|\bset of\b|\b\d+\s*x\b|\bx\s*\d+\b|paket|bundle|\bstück\b|auswahl|nach wahl", re.I)


def mots(texte):
    t = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower()
    return [m for m in re.split(r"[^a-z0-9]+", t) if len(m) >= 3 and m not in IGNORES and not m.isdigit()]


def distance(a, b):
    prec = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cour = [i]
        for j in range(1, len(b) + 1):
            cour.append(min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] != b[j - 1])))
        prec = cour
    return prec[-1]


def correspond(nom, titre):
    mn, mt = mots(nom), mots(titre)
    if not mn:
        return False
    return all(any(m == t or (len(m) >= 6 and distance(m, t) <= 1) for t in mt) for m in mn)


def relever(nom):
    d = ebay.rechercher("JB Spielwaren " + nom, 50)
    annonces = []
    for a in d.get("itemSummaries", []):
        titre = a.get("title", "")
        if "FIXED_PRICE" not in (a.get("buyingOptions") or []) or LOTS.search(titre) or not correspond(nom, titre):
            continue
        prix = float(a["price"]["value"]) if (a.get("price") or {}).get("currency") == "EUR" else None
        if not prix:
            continue
        port = [float(o["shippingCost"]["value"]) for o in a.get("shippingOptions") or [] if o.get("shippingCost")]
        annonces.append({"prix": prix, "port": min(port) if port else None, "lien": a.get("itemWebUrl", "").split("?")[0]})
    return annonces


def main():
    entree, sortie = sys.argv[1], sys.argv[2]
    noms = [l.strip() for l in open(entree, encoding="utf-8") if l.strip()]
    jour = datetime.date.today().isoformat()
    lignes = ["nom\tannonces\tprix_min\tprix_median\tprix_max\tport_median\tdate\texemples"]
    trouves = 0
    for i, nom in enumerate(noms, 1):
        try:
            a = relever(nom)
        except Exception as e:  # une recherche en erreur n'arrête pas le relevé
            print(f"{nom} : erreur {e}", file=sys.stderr)
            a = []
        if a:
            trouves += 1
            p = sorted(x["prix"] for x in a)
            ports = [x["port"] for x in a if x["port"] is not None]
            lignes.append("\t".join([nom, str(len(a)), f"{p[0]:.2f}", f"{statistics.median(p):.2f}", f"{p[-1]:.2f}",
                                     f"{statistics.median(ports):.2f}" if ports else "", jour,
                                     " ".join(x["lien"] for x in sorted(a, key=lambda x: x["prix"])[:3])]))
        else:
            lignes.append("\t".join([nom, "0", "", "", "", "", jour, ""]))
        if i % 20 == 0:
            print(f"{i}/{len(noms)} ({trouves} avec annonces)", file=sys.stderr)
        time.sleep(0.3)
    open(sortie, "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print(f"{trouves} figurines sur {len(noms)} ont des annonces -> {sortie}", file=sys.stderr)


if __name__ == "__main__":
    main()
