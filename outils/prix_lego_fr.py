#!/usr/bin/env python3
"""Prix public LEGO en France des sets récents et à venir -> data/prix_fr.tsv

Choix de l'utilisateur (01/10/2026) : tous les prix affichés sont des prix français ; seuls ceux de JB Spielwaren
restent allemands. Brickset (outils/brickset_sorties.py) ne donne que le prix LEGO allemand, et le site LEGO France
refuse les lectures automatiques (403, même depuis GitHub).

Source : Avenue de la Brique (avenuedelabrique.com), comparateur de prix français. Sa fiche d'un set affiche le prix
public LEGO France (« 59.99 € chez LEGO ») et le meilleur prix du moment chez les marchands français (« lowPrice »),
avec le nom du marchand (« 49.99 € | chez Amazon »).
La fiche est trouvée par /recherche/<numéro>. D'abord les sets sortis depuis 60 jours ou à venir (data/sorties.tsv, relus
chaque semaine), puis (18/10/2026, scan d'une boîte en magasin : meilleur prix en ligne, js/scan_boite.js) tous les sets
des 3 dernières années (data/sets.tsv, 30 pièces et plus, hors promotionnels), relus toutes les 2 semaines ; une page
toutes les 2 secondes, 400 sets au plus par passage. Un set absent d'Avenue de la Brique est noté (sans prix) pour ne
pas être recherché chaque jour. Rien n'est inventé : sans prix lu, l'appli n'affiche pas de prix.

Colonnes : code, prix (prix public LEGO France, €), meilleur prix (€), adresse de la fiche, date du relevé, marchand du
meilleur prix, prix de cette offre livraison comprise (€).
Utilisation : python3 outils/prix_lego_fr.py
"""
import datetime, html, os, re, sys, time, urllib.error, urllib.request

RACINE = os.path.join(os.path.dirname(__file__), "..")
SORTIE = os.path.join(RACINE, "data", "prix_fr.tsv")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9"}


def lire_tsv(chemin):
    if not os.path.exists(chemin):
        return []
    with open(chemin, encoding="utf-8") as f:
        lignes = [l.rstrip("\n").split("\t") for l in f if not l.startswith("#")]
    return [dict(zip(lignes[0], l)) for l in lignes[1:]] if lignes else []


BASE = "https://www.avenuedelabrique.com"


def lire(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def prix_page(numero):
    """(prix public LEGO France, meilleur prix, adresse de la fiche, marchand du meilleur prix) ; None si le set n'est pas
    trouvé"""
    recherche = lire(f"{BASE}/recherche/{numero}")
    m = re.search(r'href="((?:https://www\.avenuedelabrique\.com)?/[^"]*/' + numero + r'-[^"]*/p\d+)"', recherche)
    if not m:
        return None, None, "", "", None
    url = m.group(1) if m.group(1).startswith("http") else BASE + m.group(1)
    time.sleep(1)
    page = lire(url)
    corps = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", " ", page)
    texte = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", corps)))
    texte = re.sub(r"(\s*\|\s*)+", " | ", texte)
    public = re.search(r"(\d+(?:[.,]\d{1,2})?)\s*€\s*\|\s*chez LEGO", texte)
    meilleur = re.search(r'itemprop="lowPrice"[^>]*>\s*(\d+(?:[.,]\d{1,2})?)', page)
    nombre = lambda m: float(m.group(1).replace(",", ".")) if m else None
    # offres des marchands (comparateur de la fiche) : <div class="prodf-px …" data-prix="58.99" data-total=63.98" …>
    # … alt="Acheter LEGO Creator 31151 chez Golden Brick" … : prix, prix livraison comprise, marchand
    offres = []
    for bloc in re.findall(r'(?s)<div class="prodf-px[^"]*"(.*?)</div>', page):
        px = re.search(r'data-prix="([\d.]+)"', bloc)
        tot = re.search(r'data-total="?([\d.]+)', bloc)
        m = re.search(r'alt="Acheter [^"]*? chez ([^"]+)"', bloc)
        if px and m:
            offres.append((float(px.group(1)), float(tot.group(1)) if tot else None, html.unescape(m.group(1)).strip()))
    bas = nombre(meilleur)
    marchand, total = "", None
    if offres:
        p, total, marchand = min(offres)
        bas = p if bas is None else min(bas, p)
    return nombre(public), bas, url, marchand, total


def main():
    aujourdhui = datetime.date.today()
    debut = (aujourdhui - datetime.timedelta(days=60)).isoformat()
    recents = [s["code"] for s in lire_tsv(os.path.join(RACINE, "data", "sorties.tsv")) if s.get("sortie", "") >= debut or not s.get("sortie")]
    exclus = ("Promotional", "LEGO Brand Store", "BrickLink Designer Program", "Books", "Gear")
    autres = [s["code"] for s in lire_tsv(os.path.join(RACINE, "data", "sets.tsv"))
              if (s.get("annee") or "0").isdigit() and int(s["annee"]) >= aujourdhui.year - 2 and int(s.get("pieces") or 0) >= 30
              and not s.get("theme", "").startswith(exclus)]
    deja = {p["code"]: p for p in lire_tsv(SORTIE)}
    il_y_a = lambda j: (aujourdhui - datetime.timedelta(days=j)).isoformat()
    for p in deja.values():  # lus avant la lecture des marchands (18/10/2026) : à relire
        if p.get("meilleur") and not p.get("marchand"):
            p["date"] = "2000-01-01"
    a_lire = [c for c in recents if not (c in deja and deja[c].get("date", "") >= il_y_a(7))]
    a_lire += sorted((c for c in autres if c not in set(recents) and not (c in deja and deja[c].get("date", "") >= il_y_a(14))),
                     key=lambda c: deja.get(c, {}).get("date", ""))  # jamais lus d'abord, puis les plus anciens
    a_lire = list(dict.fromkeys(a_lire))[:400]
    trouves = refus = 0
    for code in a_lire:
        numero = code.split("-")[0]
        if not numero.isdigit():
            continue
        try:
            prix, meilleur, url, marchand, total = prix_page(numero)
        except urllib.error.HTTPError as e:
            refus += 1
            print(f"  {code} : Avenue de la Brique a répondu {e.code}", file=sys.stderr)
            if refus >= 5 and not trouves:
                print("Avenue de la Brique refuse la lecture depuis ce serveur : arrêt.", file=sys.stderr)
                break
            continue
        except Exception as e:
            print(f"  {code} : {e}", file=sys.stderr)
            continue
        # absent ou sans prix : noté quand même (date), pour ne pas le rechercher chaque jour
        deja[code] = {"code": code, "prix": f"{prix:.2f}" if prix else "", "meilleur": f"{meilleur:.2f}" if meilleur else "",
                      "url": url, "date": aujourdhui.isoformat(), "marchand": marchand, "total": f"{total:.2f}" if total else ""}
        if prix or meilleur:
            trouves += 1
            if trouves <= 8:
                print(f"  {code} : prix LEGO France {prix} €, meilleur prix {meilleur} € chez {marchand or '?'}", file=sys.stderr)
        time.sleep(2)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\ncode\tprix\tmeilleur\turl\tdate\tmarchand\ttotal\n")
        for p in sorted(deja.values(), key=lambda p: p["code"]):
            f.write("\t".join([p["code"], p.get("prix", ""), p.get("meilleur", ""), p.get("url", ""), p["date"], p.get("marchand", ""), p.get("total", "")]) + "\n")
    avec = sum(1 for p in deja.values() if p.get("marchand"))
    print(f"{trouves} prix français relevés sur {len(a_lire)} pages ({len(deja)} au total, {avec} avec le marchand) -> data/prix_fr.tsv", file=sys.stderr)


if __name__ == "__main__":
    main()
