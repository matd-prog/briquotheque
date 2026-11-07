#!/usr/bin/env python3
"""Recopie dans data/ les nouveautés de la base commune (Supabase, table commune_blisters, outils/supabase_base_commune.sql).

Base commune ouverte à tous les comptes (Mathias, 07/11/2026) : chaque compte de l'appli y envoie ses blisters. Chaque jour,
la tâche « Base commune » (.github/workflows/base_commune.yml) lance ce script : il lit les nouveautés depuis la date notée
dans data/jb_commune_maj.txt (fonction commune_export, lisible avec la clé publique de l'appli : noms et résumés de
reconnaissance seulement, ni photo ni auteur), les écrit dans les listes du catalogue (une ligne par code, remplacée si la
photo a été refaite), puis note la nouvelle date. Entre deux passages, l'appli ajoute elle-même ces nouveautés
(js/commune_en_ligne.js).
"""
import json
import os
import sys
import urllib.request

URL = "https://neadnkbroribjobpsqcu.supabase.co"
CLE = "sb_publishable_5EmR-GxELWvYIyN1NJH0pA_5q8vtetO"  # clé publique (comme js/compte.js)
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
MAJ = os.path.join(DATA, "jb_commune_maj.txt")


def propre(v):
    return " ".join(str(v or "").replace("\t", " ").split())


# fichier -> (en-tête, clé de la ligne, contenu de la ligne ; None : pas de ligne)
FICHIERS = {
    "jb_commune.tsv": ("code\tnom\tcategorie\tlien\timage\tprix\tdispo\trattache", lambda r: r["code"],
                       lambda r: "\t".join([r["code"], propre(r["nom"]), "Base commune", "", "", "", "", propre(r.get("rattache"))])),
    "jb_empreintes_commune.tsv": ("code\tempreinte", lambda r: r["code"], lambda r: r.get("empreinte") and f"{r['code']}\t{propre(r['empreinte'])}"),
    "jb_empreintes_figurine.tsv": ("code\tempreinte", lambda r: r["code"], lambda r: r.get("empreinte_fig") and f"{r['code']}\t{propre(r['empreinte_fig'])}"),
    "jb_vision_commune.tsv": ("code\tvecteur", lambda r: r["code"], lambda r: r.get("vision") and f"{r['code']}\t{propre(r['vision'])}"),
    "jb_versos.tsv": ("code\ttexte", lambda r: propre(r.get("rattache")) or r["code"],
                      lambda r: r.get("verso_texte") and f"{propre(r.get('rattache')) or r['code']}\t{propre(r['verso_texte'])}"),
}


def nouveautes(depuis):
    req = urllib.request.Request(f"{URL}/rest/v1/rpc/commune_export", data=json.dumps({"depuis": depuis}).encode(),
                                 headers={"apikey": CLE, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as rep:
        return json.load(rep)


def fusionner(nom, lignes_neuves):
    chemin = os.path.join(DATA, nom)
    entete = FICHIERS[nom][0]
    lignes = open(chemin, encoding="utf-8").read().splitlines() if os.path.exists(chemin) else [entete]
    if not lignes:
        lignes = [entete]
    neuves = dict(lignes_neuves)  # clé (majuscules) -> ligne
    res, vus = [lignes[0]], set()
    for l in lignes[1:]:
        if not l.strip():
            continue
        k = l.split("\t")[0].upper()
        if k in neuves:
            if k not in vus:
                res.append(neuves[k])
                vus.add(k)
            continue
        res.append(l)
    res += [l for k, l in neuves.items() if k not in vus]
    texte = "\n".join(res) + "\n"
    avant = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""
    if texte != avant:
        open(chemin, "w", encoding="utf-8").write(texte)
        return True
    return False


def main():
    depuis = "2000-01-01T00:00:00Z"
    if os.path.exists(MAJ):
        depuis = open(MAJ, encoding="utf-8").read().strip() or depuis
    rangs = nouveautes(depuis)
    print(f"{len(rangs)} nouveauté(s) depuis {depuis}")
    if not rangs:
        return
    for nom, (_, cle, ligne) in FICHIERS.items():
        neuves = [(cle(r).upper(), ligne(r)) for r in rangs]
        neuves = [(k, l) for k, l in neuves if l]
        if neuves and fusionner(nom, neuves):
            print(f"  {nom} : {len(neuves)} ligne(s)")
    open(MAJ, "w", encoding="utf-8").write(max(r["maj"] for r in rangs) + "\n")


if __name__ == "__main__":
    sys.exit(main())
