#!/usr/bin/env node
// Empreintes des figurines de data/nouveautes.tsv -> data/nouveautes_empreintes.tsv (code Rebrickable, empreinte).
// Seules les figurines pas encore calculées sont téléchargées (photos officielles de Rebrickable, une toutes les
// 0,3 s) ; celles qui ne sont plus dans les nouveautés sont retirées. Même calcul que l'appli
// (empreinteFigurine de js/empreinte.js, dans un navigateur sans écran) ; les photos ne sont pas gardées.
//
// Utilisation : node outils/empreintes_nouveautes.js   (Playwright et curl nécessaires)
// Si playwright n'est pas trouvé : NODE_PATH=$(npm root -g) node outils/empreintes_nouveautes.js

const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const racine = path.join(__dirname, "..");
const SORTIE = path.join(racine, "data/nouveautes_empreintes.tsv");
const attendre = ms => new Promise(r => setTimeout(r, ms));

// (Essai du 01/10 avec les porte-clés lumineux, data/objets_empreintes.tsv : abandonné, la comparaison des
// photos ne retrouvait pas le bon porte-clés ; ils sont reconnus par la référence de l'étiquette.)
const lire = f => fs.existsSync(path.join(racine, f)) ? fs.readFileSync(path.join(racine, f), "utf8").split("\n").map(l => l.split("\t")) : [];
const JEUX = [
  { sortie: SORTIE, liste: lire("data/nouveautes.tsv").filter(c => c[0] === "figurine" && c[7]).map(c => ({ code: c[1], image: c[7] })) },
];

(async () => {
  for (const jeu of JEUX) await calculer(jeu.liste, jeu.sortie);
})();

async function calculer(figurines, SORTIE) {
  const deja = new Map(fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, "utf8").split("\n").slice(1)
    .filter(Boolean).map(l => l.split("\t")) : []);
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ path: path.join(racine, "js/empreinte.js") });
  const sortie = ["code\tempreinte"];
  let nouvelles = 0, erreurs = 0;
  for (const { code, image } of figurines) {
    if (deja.has(code)) { sortie.push(`${code}\t${deja.get(code)}`); continue; }
    let octets;
    try {
      octets = execFileSync("curl", ["-sfL", "--retry", "2", "--max-time", "30", "-A", "Mozilla/5.0 (catalogue personnel de collectionneur)", image]);
    } catch (e) { erreurs++; console.error("photo inaccessible :", code); continue; }
    const type = /\.png$/i.test(image) ? "image/png" : "image/jpeg";
    const texte = await page.evaluate(async url => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return empreinteEnTexte(empreinteFigurine(img));
    }, `data:${type};base64,${octets.toString("base64")}`).catch(() => null);
    if (texte) { sortie.push(`${code}\t${texte}`); nouvelles++; } else { erreurs++; console.error("photo illisible :", code); }
    await attendre(300);
  }
  await navigateur.close();
  fs.writeFileSync(SORTIE, sortie.join("\n") + "\n");
  console.error(`${sortie.length - 1} empreintes (${nouvelles} nouvelles, ${erreurs} photos manquantes) -> ${path.relative(racine, SORTIE)}`);
}
