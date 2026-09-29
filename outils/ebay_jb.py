#!/usr/bin/env python3
"""Figurines JB Spielwaren retirées de la vente, retrouvées dans les annonces eBay.de -> data/jb_ebay.tsv

JB Spielwaren est allemand : eBay.de est la place de marché où l'on trouve le plus de leurs blisters.
Les annonces sont lues avec l'API officielle « Browse » (outils/ebay.py, clés dans EBAY_CLIENT_ID et
EBAY_CLIENT_SECRET). Pour chaque annonce d'une seule figurine JB : titre nettoyé -> nom ; si le nom
correspond à une figurine du catalogue du site (data/jb.tsv) ou de brickshellcases.com
(data/jb_brickshell.tsv, à créer avant avec outils/brickshell_jb.py), elle est ignorée ; sinon elle est gardée
(une ligne par nom, même format que data/jb.tsv) :
  code EBAY-<n° de la 1re annonce vue>, nom, catégorie, lien = recherche eBay.de (reste valable quand
  l'annonce se termine), photo de l'annonce (adresse seulement, la photo n'est pas copiée).
Pas d'empreintes de décor pour ces photos : essai du 29/09/2026, elles se ressemblent entre photos d'un
même vendeur (fond, éclairage) et passaient devant le bon blister du catalogue (35 cas sur 40).

Utilisation : python3 outils/ebay_jb.py [--detail]   (--detail : affiche les rapprochements)
"""
import collections, datetime, os, re, sys, time, unicodedata, urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
import ebay

RECHERCHES = ["JB Spielwaren", "JB-Spielwaren Minifigur", "JB Spielwaren Custom", "JB Spielwaren Blister",
              "JB Spielwaren OVP", "JB Toys Custom Minifigure"]
RACINE = os.path.join(os.path.dirname(__file__), "..")
CATALOGUE = os.path.join(RACINE, "data", "jb.tsv")
BRICKSHELL = os.path.join(RACINE, "data", "jb_brickshell.tsv")  # outils/brickshell_jb.py
SORTIE = os.path.join(RACINE, "data", "jb_ebay.tsv")

JB = re.compile(r"\bjb[\s-]?(spielwaren|toys)\b", re.I)
# annonces de plusieurs figurines, ou d'autre chose qu'une figurine
LOT = re.compile(r"konvolut|sammlung|\bset\b|\blot\b|paket|bundle|\bsets\b|\d+\s*(x\s*)?(stück\s*)?(custom\s*)?"
                 r"(mini)?fig(ur)?(en|s)\b|minifiguren|\bfiguren\b|\s\+\s|\s&\s|\sund\s|,\s", re.I)
AUTRE = re.compile(r"display|vitrine|rahmen|brickshell|\bstein\b|\bbrick\b|fliesen|vignette|geschenkbox|kalender|"
                   r"\bbuch\b|magnet|poster|aufkleber|sticker|t-shirt|tasse|\bgwp\b|\bset\s*\d{4,}|\b\d{5}\b|"
                   r"ihrer wahl|nach wahl|auswahl|promo|bauset|messebox|klemmbausteine|quotes on bricks", re.I)
# mots qui ne font pas partie du nom
BRUIT = {m.lower() for m in """lego legos legor custom costum customs minifigur minifigure minifig minifigs figur figure
    jb spielwaren toys von by aus neu new ovp nip limitiert limitierte limited limit edition le stck stück stk top zustand
    blister blisterverpackung verpackung sammlerfigur sammler star wars starwars the selten rar rare exklusiv exclusive
    original bausteine sealed mint neuwertig unbespielt ungeoffnet unopened moc up advanced der die das
    versand versandkostenfrei gratis kostenlos sammelfigur sammelfiguren nr inkl exkl teile tlg 1st 2nd 3rd jahre minifigures figures""".split()}
# mots du catalogue qui ne sont pas toujours repris dans les annonces
BRUIT_CATALOGUE = BRUIT | set("""halloween christmas easter 2022 2023 2024 2025 2026 designed bricks maze collectible
    and with of a in for""".split())
SEPARATEURS = re.compile(r"\s*[-–—]?\s*\b(?:streng\s+)?limit(?:iert|ed)\b(?:\s+auf)?|\bdesigned\s+by\b|"
                         r"\bbricks\s+of\s+maze\b|\bbrickstory\b|\bcomic\s*con\b|\s[-–—|/:]\s|\s[Ii]\s|"
                         r"#?\b\d+\s*/\s*\d+\b|\b\d+\s+(?:of|von)\s+\d+\b|#\d+|\*+|!+|\(|\)", re.I)


def normaliser(t):
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()


def mots(t, bruit):
    return [m for m in re.findall(r"[a-z0-9]+", normaliser(t)) if m not in bruit and not m.isdigit()]


def nom_depuis_titre(titre):
    """« JB Spielwaren Baron Zemo #206/250 – Custom Minifigur Marvel OVP » -> « Baron Zemo »"""
    cite = re.search(r"[\"„“]([^\"„“”]{3,40})[\"“”]", titre)
    if cite:
        return cite.group(1).strip()
    titre = re.sub(r"\([^)]*\)", " | ", titre)  # (JB-Spielwaren, LEGO Star Wars) NEU
    titre = re.sub(r"®|™", " ", titre)
    titre = re.sub(r"\bJB[\s-]?(Spielwaren|Toys)\b", " | ", titre, flags=re.I)
    for morceau in SEPARATEURS.split(titre):
        if not morceau:
            continue
        gardes = [m for m in re.findall(r"[\w'’.-]+", morceau)
                  if normaliser(m).strip(".-'") not in BRUIT and not re.fullmatch(r"[\d.-]+", m)]
        while gardes and normaliser(gardes[-1]) in {"in", "auf", "of", "from", "als", "v", "vol", "fur", "for"}:
            gardes.pop()
        if gardes:
            return " ".join(gardes).strip(" .-")
    return ""


def proche(a, b):
    return a == b or (min(len(a), len(b)) >= 5 and abs(len(a) - len(b)) <= 1 and distance(a, b) <= 1)


def distance(a, b):
    prec = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cour = [i]
        for j, cb in enumerate(b, 1):
            cour.append(min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (ca != cb)))
        prec = cour
    return prec[-1]


def dans_catalogue(titre, catalogue):
    """Figurine du catalogue dont tous les mots importants sont dans le titre de l'annonce"""
    tm = mots(titre, BRUIT)
    for code, nom, essentiels in catalogue:
        if essentiels and all(any(proche(e, m) for m in tm) for e in essentiels):
            return code, nom
    return None


def lire_catalogue(avec_brickshell=False):
    """Figurines du site JB (et, si demandé, de brickshellcases.com) : [(code, nom, mots essentiels)]"""
    res = []
    fichiers = [CATALOGUE] + ([BRICKSHELL] if avec_brickshell and os.path.exists(BRICKSHELL) else [])
    for fichier in fichiers:
        with open(fichier, encoding="utf-8") as f:
            for ligne in f:
                if re.match(r"(JB|BSC)-", ligne):
                    code, nom = ligne.split("\t")[:2]
                    res.append((code, nom, set(mots(nom, BRUIT_CATALOGUE))))
    # les noms les plus longs d'abord (« Chrome Black Spaceman » avant « Spaceman »)
    return sorted(res, key=lambda r: -len(r[2]))


def categorie(titre):
    t = normaliser(titre)
    for mots_cles, nom in [("star wars|starwars|jedi|sith|trooper|mandalorian|clone|darth|droid|bounty hunter|imperial|isb", "Galactic Heroes (Star Wars)"),
                           ("marvel|batman|superman|deadpool|avengers|spider|joker|harley|dc comics", "Super Heroes"),
                           ("halloween|horror|christmas|weihnacht|easter|ostern", "Saisonnières"),
                           ("pirat", "Pirates"), ("space|astronaut", "Space")]:
        if re.search(mots_cles, t):
            return nom
    return "Autres"


def annonces():
    jeton = ebay.jeton()
    ebay.jeton = lambda: jeton  # un seul jeton pour toutes les recherches
    tout = {}
    for texte in RECHERCHES:
        decalage = 0
        while True:
            d = ebay.rechercher(texte, 200, "EBAY_DE", decalage)
            liste = d.get("itemSummaries", [])
            for a in liste:
                tout.setdefault(a["itemId"], a)
            print(f"  « {texte} » : {min(decalage + 200, d.get('total', 0))}/{d.get('total', 0)}", file=sys.stderr)
            decalage += 200
            time.sleep(1)
            if not liste or decalage >= d.get("total", 0):
                break
    return list(tout.values())


def main():
    detail = "--detail" in sys.argv
    catalogue = lire_catalogue(avec_brickshell=True)
    stats = collections.Counter()
    nouvelles = {}  # nom normalisé -> {noms, annonces}
    vues_catalogue = set()
    for a in annonces():
        titre = a.get("title", "")
        image = (a.get("image") or {}).get("imageUrl", "")
        if not JB.search(titre):
            stats["sans JB"] += 1; continue
        sans_parentheses = re.sub(r"\([^)]*\)", " ", titre)
        if LOT.search(sans_parentheses) or AUTRE.search(titre) or not image:
            stats["lot ou autre objet"] += 1; continue
        trouve = dans_catalogue(titre, catalogue)
        if trouve:
            stats["déjà au catalogue"] += 1
            vues_catalogue.add(trouve[0])
            if detail: print(f"= {titre}  ->  {trouve[1]}")
            continue
        nom = nom_depuis_titre(titre)
        cle = " ".join(mots(nom, BRUIT))
        if not cle or len(cle.split()) > 6:
            stats["nom illisible"] += 1
            if detail: print(f"? {titre}")
            continue
        stats["nouvelle"] += 1
        g = nouvelles.setdefault(cle, {"noms": collections.Counter(), "annonces": []})
        g["noms"][nom] += 1
        g["annonces"].append(a)
        if detail: print(f"+ {titre}  ->  {nom}")

    lignes = [f"#date {datetime.date.today().isoformat()}", "code\tnom\tcategorie\tlien\timage"]
    for cle, g in sorted(nouvelles.items()):
        nom = g["noms"].most_common(1)[0][0]
        if nom.isupper() or nom.islower():
            nom = nom.title()
        premiere = min(g["annonces"], key=lambda a: a["itemId"])
        numero = premiere["itemId"].split("|")[1]
        # photo en 500 px : assez pour l'empreinte et l'aperçu, plus légère que 1600 px
        image = re.sub(r"s-l\d+\.", "s-l500.", premiere["image"]["imageUrl"])
        lien = "https://www.ebay.de/sch/i.html?" + urllib.parse.urlencode({"_nkw": f"JB Spielwaren {nom}"})
        champs = [f"EBAY-{numero}", nom, categorie(premiere["title"]), lien, image]
        lignes.append("\t".join(c.replace("\t", " ").replace("\n", " ") for c in champs))
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")
    print(", ".join(f"{n} {k}" for k, n in stats.items()), file=sys.stderr)
    print(f"{len(vues_catalogue)} figurines du catalogue vues sur eBay.de ; "
          f"{len(nouvelles)} figurines absentes du catalogue -> {os.path.normpath(SORTIE)}", file=sys.stderr)


if __name__ == "__main__":
    main()
