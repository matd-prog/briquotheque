#!/usr/bin/env python3
"""Figurines JB Spielwaren vendues par brickshellcases.com et absentes du site JB -> data/jb_brickshell.tsv

brickshellcases.com (boutique Shopify, robots.txt : tout autorisé sauf panier et commande) revend des
figurines JB, souvent retirées de la vente chez JB. Leurs photos sont celles du site JB, et leur nom de
fichier commence par le numéro d'article JB (« 648665317-LEGO-Wood-Eyed-Buccaneer… ») : ces figurines
gardent donc leur vrai code JB-<numéro>. Sinon (photo maison, ou numéro partagé par plusieurs figurines
d'un lot), code BSC-<n° de produit brickshellcases>.
Même format que data/jb.tsv : code, nom, catégorie, lien (page brickshellcases, la page JB n'existant
plus), photo (adresse seulement). Les figurines déjà dans data/jb.tsv sont ignorées.

Lecture de /products.json (liste publique de la boutique), une page toutes les 5 secondes.
Utilisation : python3 outils/brickshell_jb.py
"""
import collections, datetime, json, os, re, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import ebay_jb  # nettoyage des noms et rapprochement avec le catalogue

SITE = "https://brickshellcases.com"
PAUSE = 5
SORTIE = os.path.join(os.path.dirname(__file__), "..", "data", "jb_brickshell.tsv")
PAS_UNE_FIGURINE = re.compile(r"\bprint\b|diorama|vignette|\bpack\b|bundle|\bset\b|\btile\b|poster|display", re.I)


def produits():
    tout = []
    for n in range(1, 40):
        req = urllib.request.Request(f"{SITE}/products.json?limit=250&page={n}",
                                     headers={"User-Agent": "Mozilla/5.0 (catalogue personnel de collectionneur)"})
        for essai in range(4):
            try:
                with urllib.request.urlopen(req, context=ebay_jb.ebay.CTX, timeout=60) as r:
                    page = json.load(r)["products"]
                break
            except (urllib.error.URLError, ValueError) as e:  # trop de requêtes : on attend plus longtemps
                print(f"  page {n} : {e}, nouvel essai", file=sys.stderr)
                time.sleep(PAUSE * (essai + 2))
        else:
            sys.exit(f"brickshellcases.com : page {n} illisible")
        print(f"  page {n} : {len(page)} produits", file=sys.stderr)
        if not page:
            break
        tout += page
        time.sleep(PAUSE)
    return tout


def numero_jb(p):
    for i in p.get("images", []):
        m = re.search(r"/files/(\d{9})-", i["src"])
        if m:
            return m.group(1)
    return None


def main():
    codes_catalogue = set()
    with open(ebay_jb.CATALOGUE, encoding="utf-8") as f:
        for ligne in f:
            if ligne.startswith("JB-"):
                codes_catalogue.add(ligne.split("\t")[0])
    catalogue = ebay_jb.lire_catalogue()
    jb = [p for p in produits() if p.get("vendor") == "JB Spielwaren" and p.get("product_type") == "Custom Minifigure"
          and not PAS_UNE_FIGURINE.search(p["title"]) and p.get("images")]
    partages = collections.Counter(numero_jb(p) for p in jb)
    stats = collections.Counter()
    lignes = [f"#date {datetime.date.today().isoformat()}", "code\tnom\tcategorie\tlien\timage"]
    for p in sorted(jb, key=lambda p: p["title"].lower()):
        numero = numero_jb(p)
        if numero and f"JB-{numero}" in codes_catalogue:
            stats["déjà au catalogue JB"] += 1; continue
        if not numero and ebay_jb.dans_catalogue(p["title"], catalogue):
            stats["déjà au catalogue JB"] += 1; continue
        unique = numero and partages[numero] == 1
        code = f"JB-{numero}" if unique else f"BSC-{p['id']}"
        nom = re.sub(r"\s*\bJB[\s-]?Spielwaren\b", "", p["title"]).strip()
        image = p["images"][0]["src"]
        image += ("&" if "?" in image else "?") + "width=600"
        champs = [code, nom, ebay_jb.categorie(p["title"] + " " + " ".join(p.get("tags", []))),
                  f"{SITE}/products/{p['handle']}", image]
        lignes.append("\t".join(c.replace("\t", " ").replace("\n", " ") for c in champs))
        stats["code JB" if unique else "code BSC"] += 1
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    print(", ".join(f"{n} {k}" for k, n in stats.items()), f"-> {os.path.normpath(SORTIE)}", file=sys.stderr)


if __name__ == "__main__":
    main()
