// Contrôle complet de l'appli avant chaque publication (réécrit le 06/11/2026, rangé dans le dépôt pour survivre aux
// réinitialisations de l'environnement de travail de Claude).
// Ouvre l'appli dans un navigateur (Playwright), remplit une collection d'essai, parcourt l'accueil et chaque écran ou
// menu qu'il ouvre, Ma collection (chaque onglet, en liste et en vignettes, une fiche), dans plusieurs langues et deux
// largeurs (téléphone, ordinateur). Relève :
//   - les erreurs JavaScript (et erreurs de la console),
//   - les fichiers de l'appli introuvables (404),
//   - les textes restés en français dans une autre langue (Langue.manquants, js/langue.js).
// Internet est coupé pendant le contrôle (rien n'est envoyé nulle part) ; les messages qui demandent oui / non reçoivent
// toujours « non » (rien n'est effacé ni remplacé).
//
// Lancer depuis la racine du dépôt :   NODE_PATH=$(npm root -g) node outils/tests/controle_complet.js
// Options : --donnees <collection.json>  sauvegarde du dépôt privé (sauvegarde/collection.json) au lieu de la collection
//                                        d'essai (plus de figurines, donc plus de textes contrôlés)
//           --langues fr,en              langues à contrôler (par défaut : toutes, en largeur téléphone ; fr et de aussi
//                                        en largeur ordinateur)
// Fin : une ligne par langue et largeur ; code de sortie 1 s'il y a une erreur ou un fichier manquant.

const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const RACINE = path.resolve(__dirname, "../..");
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DONNEES = arg("--donnees");
const LANGUES = (arg("--langues") || "").split(",").filter(Boolean);
const PASSAGES = LANGUES.length ? LANGUES.map(l => [l, 412])
  : [["fr", 412], ["en", 412], ["de", 412], ["es", 412], ["fr", 1300], ["de", 1300]];
// actions de l'accueil laissées de côté : choix de fichier, géolocalisation, envoi ou remplacement de données
const SAUF = new Set(["base-depuis-excel", "magasins-autour", "sauvegarde-en-ligne", "restaurer-en-ligne", "connexion-plus-tard",
  "tout-mettre-a-jour", "enregistrer", "retour-entete"]);

// petit serveur de fichiers pour l'appli (port libre au hasard)
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".tsv": "text/plain",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm",
  ".onnx": "application/octet-stream", ".gz": "application/gzip", ".traineddata": "application/octet-stream" };
function serveur() {
  return new Promise(ok => {
    const s = http.createServer((req, rep) => {
      const f = path.join(RACINE, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rep.writeHead(404); rep.end(); return; }
      rep.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(rep);
    }).listen(0, "127.0.0.1", () => ok(s));
  });
}

// collection d'essai : quelques articles de chaque sorte (aucune donnée privée : ce dépôt est public)
async function remplirEssai(p) {
  await p.evaluate(async () => {
    const cl = etat.classeur;
    for (const f of [{ code: "sw0001a", nom: "Battle Droid", theme: "Star Wars" }, { code: "sw0581", nom: "Darth Vader", theme: "Star Wars", prixPaye: 12.5, dateAchat: "01/10/2026" },
                     { code: "hp150", nom: "Harry Potter", theme: ONGLETS_THEMES.find(o => /potter/i.test(o)) || ONGLETS_THEMES[0] },
                     { code: "CUSTOM", nom: "CHROME BLACK TROOPER 12/250", theme: THEME_CUSTOMS.onglet, prixPaye: 30 },
                     { code: "CUSTOM", nom: "SHINY DARK LORD 5/444", theme: THEME_CUSTOMS.onglet }])
      await ajouterFigurine(cl, f);
    await ajouterSet(cl, { code: "75192-1", nom: "Millennium Falcon", annee: "2017", theme: "Star Wars", pieces: "7541", etat: "Neuf scellé", quantite: 1, marque: "LEGO", prixPaye: 799 });
    await ajouterObjet(cl, { code: "", nom: "Porte-clés Dark Vador", type: "Porte-clés", etat: "Neuf", quantite: 2, prixPaye: 6 });
    await ajouterObjetJB(cl, { nom: "Tile Darth Donut", type: TYPES_JB[0], quantite: 1, prixPaye: 0, date: "20/10/2026", remarques: "", source: "" });
    await relireContenu();
  });
}

async function passage(navigateur, adresse, langue, largeur) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, isMobile: largeur < 600, hasTouch: largeur < 600 });
  const p = await ctx.newPage();
  const erreurs = [], manquants = new Set(), vus = new Set();
  p.on("pageerror", e => erreurs.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/i.test(m.text())) erreurs.push("console : " + m.text().slice(0, 200)); });
  p.on("response", r => { if (r.status() === 404 && r.url().startsWith(adresse)) manquants.add(r.url().slice(adresse.length)); });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.fulfill({ status: 200, contentType: "text/plain", body: "" })); // Internet coupé
  await p.addInitScript(l => { localStorage.setItem("langue", l); sessionStorage.setItem("sans-compte", "1"); window.open = () => null; }, langue);
  await p.goto(adresse + "index.html"); await p.waitForTimeout(1500);
  await p.evaluate(() => demarrerBase(false)); await p.waitForTimeout(1200);
  if (await p.evaluate(() => $("dialogue").open)) await p.click("#dialogue-oui");
  if (DONNEES) {
    const base = JSON.parse(fs.readFileSync(DONNEES, "utf8")).base;
    await p.evaluate(async b => { await etat.classeur.remplacerTout(b); await relireContenu(); }, base);
  } else await remplirEssai(p);

  // ferme ce qui est ouvert par-dessus (message : « non » ; menu : fermer), en notant ce qui a été vu
  const fermer = async () => {
    for (let k = 0; k < 4; k++) {
      const o = await p.evaluate(() => ({ dialogue: $("dialogue").open, menu: $("menu-actions").open, titre: $("menu-titre").innerText }));
      if (o.dialogue) { vus.add("message"); await p.click("#dialogue-non").catch(() => {}); }
      else if (o.menu) { vus.add("menu : " + o.titre.slice(0, 40)); await p.click("#menu-fermer").catch(() => {}); }
      else return;
      await p.waitForTimeout(300);
    }
  };
  const accueil = async () => { await fermer(); await p.evaluate(() => afficher("accueil")); await p.waitForTimeout(300); };

  // 1. accueil et chaque écran ou menu qu'il ouvre
  await accueil(); vus.add("accueil");
  const actions = await p.evaluate(sauf => [...new Set([...document.querySelectorAll("#ecran-accueil [data-action]")].map(b => b.dataset.action))]
    .filter(a => !sauf.includes(a)), [...SAUF]);
  for (const a of actions) {
    await accueil();
    const b = await p.$(`#ecran-accueil [data-action="${a}"]`);
    if (!b || !(await b.isVisible())) continue;
    await b.click().catch(() => {});
    await p.waitForTimeout(1500);
    vus.add(await p.evaluate(() => ecranActuel));
    await fermer();
  }
  // 2. Ma collection : chaque onglet, en liste puis en vignettes, et la fiche du premier article
  await accueil();
  await p.evaluate(() => Collection.ouvrir()); await p.waitForTimeout(1200);
  const onglets = await p.evaluate(() => [...document.querySelectorAll("#collection-onglets [data-onglet]")].map(b => b.dataset.onglet));
  for (const o of onglets) {
    for (const vue of ["liste", "vignettes"]) {
      await p.click(`#collection-onglets [data-onglet="${o}"]`).catch(() => {});
      await p.click(`#collection-bascule [data-vue="${vue}"]`).catch(() => {});
      await p.waitForTimeout(700);
    }
    const art = await p.$("#collection-contenu [data-case], #collection-contenu [data-article]");
    if (art && await art.isVisible()) { await art.click().catch(() => {}); await p.waitForTimeout(900); await fermer();
      await p.keyboard.press("Escape").catch(() => {}); }
    vus.add("collection : " + o);
  }
  await p.click("#ecran-collection details.ajouter-collection summary").catch(() => {});
  await p.waitForTimeout(400);

  const nonTraduits = langue === "fr" ? [] : await p.evaluate(() => [...Langue.manquants.keys()]);
  await ctx.close();
  return { erreurs: [...new Set(erreurs)], manquants: [...manquants], nonTraduits, vus: vus.size };
}

(async () => {
  const s = await serveur();
  const adresse = `http://127.0.0.1:${s.address().port}/`;
  const navigateur = await chromium.launch();
  let probleme = false;
  const lignes = [];
  for (const [langue, largeur] of PASSAGES) {
    const r = await passage(navigateur, adresse, langue, largeur);
    if (r.erreurs.length) console.log(`${langue} ${largeur}px erreurs :`, r.erreurs);
    if (r.manquants.length) console.log(`${langue} ${largeur}px fichiers manquants :`, r.manquants);
    if (r.nonTraduits.length) console.log(`${langue} ${largeur}px non traduits :`, JSON.stringify(r.nonTraduits));
    probleme = probleme || r.erreurs.length > 0 || r.manquants.length > 0;
    lignes.push(`${langue} ${largeur}px | ${r.vus} écrans/menus, ${r.erreurs.length} erreur(s), ${r.manquants.length} fichier(s) manquant(s), ${r.nonTraduits.length} texte(s) non traduit(s)`);
  }
  await navigateur.close(); s.close();
  console.log(lignes.join("\n"));
  process.exit(probleme ? 1 : 0);
})();
