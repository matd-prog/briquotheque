#!/usr/bin/env node
// Résumés d'image de référence pour la reconnaissance (js/vision.js, modèle DINOv2 de lib/vision/), calculés avec
// le même code que l'appli, dans un navigateur sans écran :
//  - data/jb_vision.tsv : photos du catalogue JB (site, BrickShell, archives, eBay ; téléchargées, pas gardées) et,
//    si le dépôt privé est là, photos de l'album (blisters.tsv, code de la figurine) ;
//  - data/jb_vision_commune.tsv : photos de la base commune (dépôt privé), pour les figurines de data/jb_commune.tsv
//    (ensuite complété à chaque envoi par l'appli, js/base_commune.js).
//
// Utilisation : node outils/vision_jb.js [dossier album_photos du dépôt privé]
// Si playwright n'est pas trouvé : NODE_PATH=$(npm root -g) node outils/vision_jb.js …

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const racine = path.join(__dirname, "..");
const album = process.argv[2] || path.join(racine, "../collection-lego-prive/album_photos");
const lignesTsv = f => fs.existsSync(path.join(racine, f)) ? fs.readFileSync(path.join(racine, f), "utf8").split("\n") : [];
const attendre = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".html": "text/html" };

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  // fichiers de l'appli servis tels quels (le modèle et le moteur sont chargés par adresse relative)
  await page.route("http://appli.local/**", route => {
    const f = path.join(racine, decodeURIComponent(new URL(route.request().url()).pathname));
    if (!f.startsWith(racine) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await page.route("http://appli.local/", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
  await page.goto("http://appli.local/");
  await page.addScriptTag({ url: "http://appli.local/js/vision.js" });
  const resume = async (octets, type) => page.evaluate(async url => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Vision.enTexte(await Vision.vecteur(img));
  }, `data:${type};base64,${octets.toString("base64")}`).catch(err => { console.error(String(err).slice(0, 200)); return null; });

  // catalogue
  const sortie = ["code\tvecteur"];
  let erreurs = 0;
  for (const f of ["data/jb.tsv", "data/jb_brickshell.tsv", "data/jb_archive.tsv", "data/jb_ebay.tsv"]) {
    for (const ligne of lignesTsv(f)) {
      const [code, , , , image] = ligne.split("\t");
      if (!code || code === "code" || code.startsWith("#") || !/^https?:/.test(image || "")) continue;
      let octets;
      try {
        octets = execFileSync("curl", ["-sf", "--retry", "2", "--max-time", "30", "-A", "Mozilla/5.0 (catalogue personnel de collectionneur)", image]);
      } catch (e) { erreurs++; console.error("photo inaccessible :", code); continue; }
      const v = await resume(octets, /\.png(\?|$)/i.test(image) ? "image/png" : "image/jpeg");
      if (v) sortie.push(`${code}\t${v}`); else { erreurs++; console.error("photo illisible :", code); }
      await attendre(200);
    }
  }
  // album (dépôt privé) : photo, nom, numéro, code de la figurine
  const albumTsv = path.join(album, "blisters.tsv");
  if (fs.existsSync(albumTsv)) {
    for (const ligne of fs.readFileSync(albumTsv, "utf8").split("\n").slice(1)) {
      const [photo, , , code] = ligne.split("\t");
      if (!photo || !code || !fs.existsSync(path.join(album, photo))) continue;
      const v = await resume(fs.readFileSync(path.join(album, photo)), "image/jpeg");
      if (v) sortie.push(`${code}\t${v}`);
    }
  }
  fs.writeFileSync(path.join(racine, "data/jb_vision.tsv"), sortie.join("\n") + "\n");
  console.error(`${sortie.length - 1} résumés (${erreurs} photos manquantes) -> data/jb_vision.tsv`);

  // base commune (dépôt privé) : une photo par figurine publiée
  const communeTsv = path.join(album, "commune.tsv");
  if (fs.existsSync(communeTsv)) {
    const publies = new Set(lignesTsv("data/jb_commune.tsv").map(l => l.split("\t")[0]).filter(c => /^BC-/.test(c)));
    const commune = ["code\tvecteur"];
    for (const ligne of fs.readFileSync(communeTsv, "utf8").split("\n").slice(1)) {
      const t = ligne.split("\t"), code = t[0], photo = t[8];
      if (!publies.has(code) || !photo || !fs.existsSync(path.join(album, photo))) continue;
      const v = await resume(fs.readFileSync(path.join(album, photo)), "image/jpeg");
      if (v) commune.push(`${code}\t${v}`);
    }
    fs.writeFileSync(path.join(racine, "data/jb_vision_commune.tsv"), commune.join("\n") + "\n");
    console.error(`${commune.length - 1} résumés -> data/jb_vision_commune.tsv`);
  }
  await navigateur.close();
})();
