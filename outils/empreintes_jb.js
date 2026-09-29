#!/usr/bin/env node
// Empreintes des blisters du catalogue JB -> data/jb_empreintes.tsv (code, empreinte en base64).
// Télécharge chaque photo de data/jb.tsv, et de data/jb_brickshell.tsv pour les figurines dont le
// numéro d'article JB est connu (mêmes photos que le site JB) ; pas les photos eBay (essai du 29/09 :
// elles faussaient la comparaison). Une photo toutes les 0,5 s ; empreinte calculée avec le
// même code que l'appli (js/empreinte.js, dans un navigateur sans écran) ; les photos ne sont pas gardées.
//
// Utilisation : node outils/empreintes_jb.js   (Playwright et curl nécessaires)
// Si playwright n'est pas trouvé : NODE_PATH=$(npm root -g) node outils/empreintes_jb.js

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const racine = path.join(__dirname, "..");
const lireTsv = fichier => fs.existsSync(path.join(racine, fichier))
  ? fs.readFileSync(path.join(racine, fichier), "utf8").split("\n").filter(l => l.startsWith("JB-")) : [];
// (data/jb_archive.tsv : figurines retirées retrouvées dans les archives, mêmes photos que le site JB)
const lignes = [...lireTsv("data/jb.tsv"), ...lireTsv("data/jb_brickshell.tsv"), ...lireTsv("data/jb_archive.tsv")];
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
