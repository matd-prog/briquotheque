#!/usr/bin/env python3
"""Prix public LEGO en France des sets récents et à venir -> data/prix_fr.tsv

Choix de l'utilisateur (01/10/2026) : tous les prix affichés sont des prix français ; seuls ceux de JB Spielwaren
restent allemands. Brickset (outils/brickset_sorties.py) ne donne que le prix LEGO allemand, et le site LEGO France
refuse les lectures automatiques (403, même depuis GitHub).

Source : Avenue de la Brique (avenuedelabrique.com), comparateur de prix français. Sa fiche d'un set affiche le prix
public LEGO France (« 59.99 € chez LEGO ») et le meilleur prix du moment chez les marchands français (« lowPrice »).
La fiche est trouvée par /recherche/<numéro>. Sets sortis depuis 60 jours ou à venir (data/sorties.tsv) ; une page
toutes les 2 secondes, 150 sets au plus par passage ; un prix relevé depuis moins de 7 jours n'est pas relu.
Rien n'est inventé : sans prix lu, l'appli n'affiche pas de prix.

Colonnes : code, prix (prix public LEGO France, €), meilleur prix (€), adresse de la fiche, date du relevé.
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
    """(prix public LEGO France, meilleur prix, adresse de la fiche) ; None si le set n'est pas trouvé"""
    recherche = lire(f"{BASE}/recherche/{numero}")
    m = re.search(r'href="((?:https://www\.avenuedelabrique\.com)?/[^"]*/' + numero + r'-[^"]*/p\d+)"', recherche)
    if not m:
        return None, None, ""
    url = m.group(1) if m.group(1).startswith("http") else BASE + m.group(1)
    time.sleep(1)
    page = lire(url)
    corps = re.sub(r"(?s)<script.*?</script>|<style.*?</style>", " ", page)
    texte = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " | ", corps)))
    texte = re.sub(r"(\s*\|\s*)+", " | ", texte)
    public = re.search(r"(\d+(?:[.,]\d{1,2})?)\s*€\s*\|\s*chez LEGO", texte)
    meilleur = re.search(r'itemprop="lowPrice"[^>]*>\s*(\d+(?:[.,]\d{1,2})?)', page)
    nombre = lambda m: float(m.group(1).replace(",", ".")) if m else None
    return nombre(public), nombre(meilleur), url


def main():
    aujourdhui = datetime.date.today()
    debut = (aujourdhui - datetime.timedelta(days=60)).isoformat()
    sets = [s for s in lire_tsv(os.path.join(RACINE, "data", "sorties.tsv")) if s.get("sortie", "") >= debut or not s.get("sortie")]
    deja = {p["code"]: p for p in lire_tsv(SORTIE)}
    recent = (aujourdhui - datetime.timedelta(days=7)).isoformat()
    a_lire = [s["code"] for s in sets if not (s["code"] in deja and deja[s["code"]].get("date", "") >= recent)][:150]
    trouves = refus = 0
    for code in a_lire:
        numero = code.split("-")[0]
        if not numero.isdigit():
            continue
        try:
            prix, meilleur, url = prix_page(numero)
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
        if prix or meilleur:
            deja[code] = {"code": code, "prix": f"{prix:.2f}" if prix else "", "meilleur": f"{meilleur:.2f}" if meilleur else "",
                          "url": url, "date": aujourdhui.isoformat()}
            trouves += 1
            if trouves <= 8:
                print(f"  {code} : prix LEGO France {prix} €, meilleur prix {meilleur} €", file=sys.stderr)
        time.sleep(2)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(f"#date {aujourdhui.isoformat()}\ncode\tprix\tmeilleur\turl\tdate\n")
        for p in sorted(deja.values(), key=lambda p: p["code"]):
            f.write("\t".join([p["code"], p.get("prix", ""), p.get("meilleur", ""), p.get("url", ""), p["date"]]) + "\n")
    print(f"{trouves} prix français relevés sur {len(a_lire)} pages ({len(deja)} au total) -> data/prix_fr.tsv", file=sys.stderr)


if __name__ == "__main__":
    main()
