#!/usr/bin/env node
// Résumés d'image (modèle DINOv2 de l'appli, js/vision.js) des porte-clés du catalogue des objets dérivés
// (data/objets.tsv, « Key Chain » et « Key Light », photo officielle Rebrickable) -> data/porte_cles_vision.tsv
// (code BrickLink, résumé). L'appli compare la photo d'une figurine à ces résumés pour proposer le porte-clés, même
// quand la figurine est prise pour un autre personnage (Mathias, 11/11/2026 : « on ne peut pas prendre une photo d'un
// truc qu'on ne connaît pas pour que l'appli l'identifie »). Seuls les porte-clés pas encore calculés sont téléchargés.
//
// Utilisation : node outils/vision_porte_cles.js   (Playwright et curl nécessaires ; lancé chaque nuit par sets.yml)

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const racine = path.join(__dirname, "..");
const SORTIE = path.join(racine, "data/porte_cles_vision.tsv");
const attendre = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".json": "application/json" };

(async () => {
  const objets = fs.readFileSync(path.join(racine, "data/objets.tsv"), "utf8").split("\n").map(l => l.split("\t"))
    .filter(c => c[1] && /key ?(chain|light)/i.test(`${c[3]} ${c[4]}`) && /^https?:/.test(c[6] || ""))
    .map(c => ({ code: c[1], image: c[6] }));
  const deja = new Map(fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, "utf8").split("\n").slice(1).filter(Boolean).map(l => l.split("\t")) : []);
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.route("http://appli.local/**", route => {
    const f = path.join(racine, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await page.route("http://appli.local/", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await page.goto("http://appli.local/");
  await page.addScriptTag({ url: "http://appli.local/js/vision.js" });
  const sortie = ["code\tvecteur"], vus = new Set();
  let nouveaux = 0, erreurs = 0;
  for (const { code, image } of objets) {
    if (vus.has(code)) continue;
    vus.add(code);
    if (deja.has(code)) { sortie.push(`${code}\t${deja.get(code)}`); continue; }
    let octets;
    try { octets = execFileSync("curl", ["-sfL", "--retry", "2", "--max-time", "30", "-A", "Mozilla/5.0 (catalogue personnel de collectionneur)", image]); }
    catch (e) { erreurs++; continue; }
    const type = /\.png(\?|$)/i.test(image) ? "image/png" : "image/jpeg";
    const v = await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode();
      return Vision.enTexte(await Vision.vecteur(img));
    }, `data:${type};base64,${octets.toString("base64")}`).catch(err => { console.error(String(err).slice(0, 160)); return null; });
    if (v) { sortie.push(`${code}\t${v}`); nouveaux++; } else erreurs++;
    await attendre(200);
  }
  await navigateur.close();
  fs.writeFileSync(SORTIE, sortie.join("\n") + "\n");
  console.error(`${sortie.length - 1} porte-clés (${nouveaux} nouveaux, ${erreurs} photos manquantes) -> data/porte_cles_vision.tsv`);
})();
