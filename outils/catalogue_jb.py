#!/usr/bin/env python3
"""Catalogue des figurines custom JB Spielwaren -> data/jb.tsv

Lit les pages de catégories « Custom Minifigures » du site (en anglais), autorisées par
leur robots.txt, et garde pour chaque figurine : code (JB-<numéro d'article>), nom,
catégorie, lien de la page et adresse de la photo (la photo n'est pas copiée).
Une page toutes les 2 secondes, pour ne pas surcharger le site.

Utilisation : python3 outils/catalogue_jb.py
"""
import datetime, html, json, os, re, ssl, sys, time, urllib.request

SITE = "https://www.jb-spielwaren.de"
CATEGORIES = {  # sous-catégorie du site -> nom affiché dans l'appli
    "galactic-heroes": "Galactic Heroes (Star Wars)",
    "super-heroes": "Super Heroes",
    "movies-series": "Films & Séries",
    "gaming": "Jeux vidéo",
    "fantasy": "Fantasy",
    "space": "Space",
    "piraten": "Pirates",
    "seasonal": "Saisonnières",
    "sports": "Sport",
    "other": "Autres",
}
PAUSE = 2
SORTIE = os.path.join(os.path.dirname(__file__), "..", "data", "jb.tsv")


def contexte_ssl():
    for f in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if f and os.path.exists(f):
            return ssl.create_default_context(cafile=f)
    return ssl.create_default_context()


CTX = contexte_ssl()


def lire(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (catalogue personnel de collectionneur)"})
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def figurines_de_la_page(page):
    """Figurines décrites dans le JSON de la page : {id: {nom, lien, image}}"""
    res = {}
    ids = [(m.start(), int(m.group(1))) for m in re.finditer(r'"item":\{"id":(\d+)', page)]
    images = {}
    for m in re.finditer(r'"urlMiddle":"(https:\\/\\/[^"]+?\\/item\\/images\\/(\d+)\\/middle\\/[^"]+)"', page):
        images.setdefault(int(m.group(2)), m.group(1).replace("\\/", "/"))
    for m in re.finditer(r'"texts":(\{[^{}]*"lang":"en"[^{}]*\})', page):
        avant = [i for pos, i in ids if pos < m.start()]
        if not avant:
            continue
        try:
            t = json.loads(m.group(1))
        except ValueError:
            continue
        ident = avant[-1]
        if ident in res or not t.get("urlPath"):
            continue
        res[ident] = {
            "nom": html.unescape(t.get("name1") or t.get("name2") or "").strip(),
            "lien": f"{SITE}/en/{t['urlPath']}/a-{ident}/",
            "image": images.get(ident, ""),
        }
    return res


def categorie(slug):
    tout = {}
    for n in range(1, 50):
        url = f"{SITE}/en/custom-minifigures/{slug}/" + (f"?page={n}" if n > 1 else "")
        page = lire(url)
        figs = figurines_de_la_page(page)
        nouvelles = {k: v for k, v in figs.items() if k not in tout}
        print(f"  {slug} page {n} : {len(figs)} figurines ({len(nouvelles)} nouvelles)", file=sys.stderr)
        tout.update(nouvelles)
        time.sleep(PAUSE)
        if not nouvelles or f"page={n + 1}" not in page:
            break
    return tout


def main():
    catalogue = {}
    for slug, nom_cat in CATEGORIES.items():
        for ident, f in categorie(slug).items():
            catalogue.setdefault(ident, {**f, "categorie": nom_cat})
    # figurines rangées seulement dans la catégorie principale
    principale = {}
    for n in range(1, 50):
        page = lire(f"{SITE}/en/custom-minifigures/" + (f"?page={n}" if n > 1 else ""))
        figs = figurines_de_la_page(page)
        nouvelles = {k: v for k, v in figs.items() if k not in principale}
        principale.update(nouvelles)
        print(f"  (toutes) page {n} : {len(nouvelles)} nouvelles", file=sys.stderr)
        time.sleep(PAUSE)
        if not nouvelles or f"page={n + 1}" not in page:
            break
    for ident, f in principale.items():
        catalogue.setdefault(ident, {**f, "categorie": "Autres"})

    lignes = [f"#date {datetime.date.today().isoformat()}", "code\tnom\tcategorie\tlien\timage"]
    for ident, f in sorted(catalogue.items(), key=lambda x: x[1]["nom"].lower()):
        champs = [f"JB-{ident}", f["nom"], f["categorie"], f["lien"], f["image"]]
        lignes.append("\t".join(c.replace("\t", " ").replace("\n", " ") for c in champs))
    with open(SORTIE, "w", encoding="utf-8") as fic:
        fic.write("\n".join(lignes) + "\n")
    print(f"{len(catalogue)} figurines JB -> {os.path.normpath(SORTIE)}", file=sys.stderr)


if __name__ == "__main__":
    main()
