#!/usr/bin/env python3
# Modèle de vision DINOv2 (petite version, format ONNX) -> lib/vision/, pour comparer les photos de
# blisters par leur contenu (reconnaissance d'image, comme les scanners de cartes à collectionner).
# Tourne sur les serveurs de GitHub, car Hugging Face refuse l'environnement cloud de Claude.
# Télécharge aussi les photos du catalogue JB (site, BrickShell, archives, eBay) dans /tmp/catalogue,
# rangées dans un « artifact » du workflow (pas dans le dépôt) pour les essais de reconnaissance.
import os, subprocess, sys, time

DEPOTS = ["onnx-community/dinov2-small", "Xenova/dinov2-small"]
FICHIERS = ["onnx/model_quantized.onnx", "onnx/model_fp16.onnx", "onnx/model.onnx", "preprocessor_config.json", "config.json"]
os.makedirs("lib/vision", exist_ok=True)
os.makedirs("/tmp/modeles", exist_ok=True)


def telecharger(url, dest):
    r = subprocess.run(["curl", "-sfL", "--retry", "3", "--max-time", "600", "-o", dest, url])
    return r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0


for depot in DEPOTS:
    p = depot.replace("/", "_")
    ok = []
    for f in FICHIERS:
        dest = f"/tmp/modeles/{p}_{f.replace('/', '_')}"
        if telecharger(f"https://huggingface.co/{depot}/resolve/main/{f}", dest):
            ok.append(f)
            print(depot, f, os.path.getsize(dest), "octets")
        else:
            print(depot, f, "absent")
    if "onnx/model_quantized.onnx" in ok and "preprocessor_config.json" in ok:
        os.replace(f"/tmp/modeles/{p}_onnx_model_quantized.onnx", "lib/vision/dinov2_small_q8.onnx")
        os.replace(f"/tmp/modeles/{p}_preprocessor_config.json", "lib/vision/preprocessor_config.json")
        break
else:
    sys.exit("modèle introuvable")

# photos du catalogue JB
os.makedirs("/tmp/catalogue", exist_ok=True)
n = 0
for fichier in ["data/jb.tsv", "data/jb_brickshell.tsv", "data/jb_archive.tsv", "data/jb_ebay.tsv"]:
    if not os.path.exists(fichier):
        continue
    for ligne in open(fichier, encoding="utf8"):
        t = ligne.rstrip("\n").split("\t")
        if len(t) < 5 or t[0] == "code" or not t[4].startswith("http"):
            continue
        ext = ".png" if t[4].lower().split("?")[0].endswith(".png") else ".jpg"
        dest = f"/tmp/catalogue/{t[0]}{ext}"
        if os.path.exists(dest):
            continue
        r = subprocess.run(["curl", "-sf", "--retry", "2", "--max-time", "30", "-A",
                            "Mozilla/5.0 (catalogue personnel de collectionneur)", "-o", dest, t[4]])
        if r.returncode == 0:
            n += 1
        time.sleep(0.3)
print(n, "photos du catalogue")
