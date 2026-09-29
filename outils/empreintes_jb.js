#!/usr/bin/env node
// Empreintes des blisters du catalogue JB -> data/jb_empreintes.tsv (code, empreinte en base64).
// Télécharge chaque photo de data/jb.tsv (une toutes les 0,5 s), calcule son empreinte avec le
// même code que l'appli (js/empreinte.js, dans un navigateur sans écran) ; les photos ne sont pas gardées.
//
// Utilisation : node outils/empreintes_jb.js   (Playwright et curl nécessaires)
// Si playwright n'est pas trouvé : NODE_PATH=$(npm root -g) node outils/empreintes_jb.js

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const racine = path.join(__dirname, "..");
const lignes = fs.readFileSync(path.join(racine, "data/jb.tsv"), "utf8").split("\n").filter(l => l.startsWith("JB-"));
const attendre = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ path: path.join(racine, "js/empreinte.js") });
  const sortie = ["code\tempreinte"];
  let erreurs = 0;
  for (const ligne of lignes) {
    const [code, , , , image] = ligne.split("\t");
    if (!image) continue;
    let octets;
    try {
      octets = execFileSync("curl", ["-sf", "--retry", "2", "--max-time", "30", "-A", "Mozilla/5.0 (catalogue personnel de collectionneur)", image]);
    } catch (e) { erreurs++; console.error("photo inaccessible :", code); continue; }
    const type = /\.png$/i.test(image) ? "image/png" : "image/jpeg";
    const texte = await page.evaluate(async url => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return empreinteEnTexte(empreinteImage(img, true));
    }, `data:${type};base64,${octets.toString("base64")}`).catch(() => null);
    if (texte) sortie.push(`${code}\t${texte}`); else { erreurs++; console.error("photo illisible :", code); }
    await attendre(500);
  }
  await navigateur.close();
  fs.writeFileSync(path.join(racine, "data/jb_empreintes.tsv"), sortie.join("\n") + "\n");
  console.error(`${sortie.length - 1} empreintes (${erreurs} photos manquantes) -> data/jb_empreintes.tsv`);
})();
