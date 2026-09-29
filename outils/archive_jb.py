#!/usr/bin/env python3
"""Anciennes figurines custom JB Spielwaren, retrouvées dans les archives du web -> data/jb_archive.tsv

Internet Archive (web.archive.org) garde des copies des pages de catégories « Custom Minifigures » du
site JB depuis plusieurs années. On relit ces copies avec le même lecteur que outils/catalogue_jb.py :
chaque figurine y a son numéro d'article (donc son vrai code JB-…), son nom et l'adresse de sa photo.
On garde celles qui ne sont plus sur le site JB (data/jb.tsv) ni chez brickshellcases.com
(data/jb_brickshell.tsv). Même format que data/jb.tsv ; lien : copie archivée de la page de la
figurine si elle existe, sinon recherche eBay.de sur son nom.

Internet Archive refuse les connexions de l'environnement cloud de Claude (erreur 429) : l'outil
tourne sur GitHub (.github/workflows/archive_jb.yml, bouton « Run workflow »).
Poliment : une copie toutes les 3 secondes, une copie par page et par mois au plus.

Utilisation : python3 outils/archive_jb.py [--max N]   (N : nombre maximal de copies lues)
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import catalogue_jb, ebay_jb

CDX = "https://web.archive.org/cdx/search/cdx"
PAUSE = 3
RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "data", "jb_archive.tsv")
UA = {"User-Agent": "Mozilla/5.0 (catalogue personnel de collectionneur ; figurines LEGO JB Spielwaren)"}


def lire(url, essais=4):
    for essai in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # archive occupée : on attend de plus en plus longtemps
            print(f"    {e} ({url[:90]}…), nouvel essai", file=sys.stderr)
            time.sleep(PAUSE * 3 * (essai + 1))
    return None


def index(parametres):
    """Lignes de l'index des copies (CDX) : [[original, timestamp], …]"""
    texte = lire(CDX + "?" + urllib.parse.urlencode({**parametres, "output": "json", "fl": "original,timestamp"}, doseq=True))
    if not texte:
        sys.exit("Index d'Internet Archive illisible")
    lignes = json.loads(texte or "[]")
    return lignes[1:] if lignes else []


def main():
    maximum = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 1500
    # 1) copies des pages de catégories, une par page et par mois
    copies = index({"url": "jb-spielwaren.de/en/custom-minifigures/", "matchType": "prefix",
                    "filter": "statuscode:200", "collapse": "digest"})
    par_mois = {}
    for original, ts in copies:
        cle = (re.sub(r"^https?://(www\.)?", "", original).rstrip("/").lower(), ts[:6])
        par_mois.setdefault(cle, (original, ts))
    choisies = sorted(par_mois.values(), key=lambda c: c[1], reverse=True)[:maximum]
    print(f"{len(copies)} copies de pages de catégories, {len(choisies)} lues", file=sys.stderr)

    # 2) figurines de chaque copie (lecteur de catalogue_jb.py)
    figurines = {}  # numéro -> {nom, image, categorie, ts}
    for n, (original, ts) in enumerate(choisies, 1):
        page = lire(f"https://web.archive.org/web/{ts}id_/{original}")
        time.sleep(PAUSE)
        if not page:
            continue
        slug = re.search(r"custom-minifigures/([a-z-]+)", original)
        categorie = catalogue_jb.CATEGORIES.get(slug.group(1) if slug else "", "Autres")
        trouvees = catalogue_jb.figurines_de_la_page(page)
        for ident, f in trouvees.items():
            ancienne = figurines.get(ident)
            if not ancienne or (ancienne["categorie"] == "Autres" and categorie != "Autres"):
                figurines[ident] = {**f, "categorie": categorie, "ts": ts}
        if n % 20 == 0 or n == len(choisies):
            print(f"  {n}/{len(choisies)} copies lues, {len(figurines)} figurines", file=sys.stderr)

    # 3) on écarte les figurines encore en vente (site JB) ou revendues par brickshellcases.com
    connues = set()
    for fichier in (ebay_jb.CATALOGUE, ebay_jb.BRICKSHELL):
        if os.path.exists(fichier):
            with open(fichier, encoding="utf-8") as f:
                connues |= {l.split("\t")[0] for l in f if l.startswith("JB-")}
    retirees = {i: f for i, f in figurines.items() if f"JB-{i}" not in connues and f["nom"]}

    # 4) pages de figurines archivées (pour le lien de l'étiquette)
    pages = {}
    for original, ts in index({"url": "jb-spielwaren.de/en/", "matchType": "prefix", "filter": ["statuscode:200", "original:.*/a-[0-9]+/?$"],
                               "collapse": "urlkey"}):
        m = re.search(r"/a-(\d+)/?$", original)
        if m:
            pages[int(m.group(1))] = f"https://web.archive.org/web/{ts}/{original}"

    lignes = [f"#date {datetime.date.today().isoformat()}", "code\tnom\tcategorie\tlien\timage"]
    for ident, f in sorted(retirees.items(), key=lambda x: x[1]["nom"].lower()):
        # sans page archivée : recherche eBay.de sur le nom court (« Arkanthos - Blue Tower Knight Custom
        # Minifigure » -> « Arkanthos Blue Tower Knight » ; un « - » exclurait des mots de la recherche)
        court = re.split(r"\s+(?:c[ou]s?t[ou]m|minifig\w*|designed|by)\b", f["nom"], flags=re.I)[0]
        lien = pages.get(ident) or ebay_jb.lien_recherche(re.sub(r"\s+-(\s+|$)", " ", court).strip())
        champs = [f"JB-{ident}", f["nom"], f["categorie"], lien, f.get("image", "")]
        lignes.append("\t".join(c.replace("\t", " ").replace("\n", " ") for c in champs))
    with open(SORTIE, "w", encoding="utf-8") as fic:
        fic.write("\n".join(lignes) + "\n")
    print(f"{len(figurines)} figurines vues dans les archives ; {len(retirees)} plus en vente -> "
          f"{os.path.normpath(SORTIE)} ({sum(1 for i in retirees if i in pages)} avec page archivée)", file=sys.stderr)


if __name__ == "__main__":
    main()
