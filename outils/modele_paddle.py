#!/usr/bin/env python3
"""Prépare les modèles PaddleOCR de l'appli -> lib/paddle/ (det.onnx, rec.onnx, cles.txt)

Modèles PP-OCRv4 (licence Apache 2.0) pris dans le paquet Python rapidocr-onnxruntime. Le modèle de
lecture reconnaît 6 625 caractères (surtout chinois) : on ne garde que les caractères latins (129),
ce qui l'allège (10,9 -> 7,7 Mo) et évite les confusions (« 八 » lu à la place de « 1 »).
Le moteur (lib/paddle/ort.wasm.min.js, ort-wasm-simd-threaded.mjs et .wasm) vient du paquet npm
onnxruntime-web (licence MIT), dossier dist/.

Utilisation : pip install rapidocr-onnxruntime onnx ; python3 outils/modele_paddle.py
"""
import os, shutil
import numpy as np, onnx, onnxruntime
from onnx import numpy_helper
import rapidocr_onnxruntime

SOURCE = os.path.join(os.path.dirname(rapidocr_onnxruntime.__file__), "models")
SORTIE = os.path.join(os.path.dirname(__file__), "..", "lib", "paddle")

rec = os.path.join(SOURCE, "ch_PP-OCRv4_rec_infer.onnx")
caracteres = onnxruntime.InferenceSession(rec).get_modelmeta().custom_metadata_map["character"].splitlines()
tous = ["<blanc>"] + caracteres + [" "]  # 0 : « blanc » du décodage ; dernier : espace
garder = [0] + [i for i, c in enumerate(tous) if 0 < i < len(tous) - 1 and len(c) == 1 and 32 < ord(c) < 0x250] + [len(tous) - 1]

modele = onnx.load(rec)
for noeud in modele.graph.node:  # dernière couche : ne garder que les colonnes des caractères latins
    if noeud.op_type == "Constant" and noeud.output[0] in ("linear_85.w_0", "linear_85.b_0"):
        t = noeud.attribute[0].t
        t.CopyFrom(numpy_helper.from_array(np.ascontiguousarray(numpy_helper.to_array(t)[..., garder]), t.name))
modele.graph.output[0].type.tensor_type.shape.dim[2].dim_value = len(garder)
del modele.metadata_props[:]
os.makedirs(SORTIE, exist_ok=True)
onnx.save(modele, os.path.join(SORTIE, "rec.onnx"))
with open(os.path.join(SORTIE, "cles.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(tous[i] for i in garder[1:-1]))
shutil.copy(os.path.join(SOURCE, "ch_PP-OCRv4_det_infer.onnx"), os.path.join(SORTIE, "det.onnx"))
print(f"{len(garder) - 2} caractères gardés -> {os.path.normpath(SORTIE)}")
