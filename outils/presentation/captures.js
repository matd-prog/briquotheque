// Captures d'écran de l'appli pour la présentation à JB Spielwaren (Ma collection, fiche, reconnaissance).
// Lancer : python3 -m http.server 8765 (racine du dépôt) puis NODE_PATH=$(npm root -g) node captures.js ;
// blisters.json (à côté) : blisters de la base commune bien cadrés, avec verso. Jamais de prix sur les captures.
const { chromium, devices } = require("playwright"); const fs = require("fs");
const A = "/home/user/collection-lego-prive/album_photos/", D = __dirname;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage();
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500);
  await p.evaluate(() => { demarrerBase(false); }); await p.waitForTimeout(1500);
  if (await p.evaluate(() => $("dialogue").open)) await p.click("#dialogue-oui");
  const s = JSON.parse(fs.readFileSync("/home/user/collection-lego-prive/sauvegarde/collection.json", "utf8"));
  const bl = JSON.parse(fs.readFileSync(D + "/blisters.json", "utf8")).map(x => ({ ...x, r: fs.readFileSync(A + x.recto).toString("base64"), v: fs.readFileSync(A + x.verso).toString("base64") }));
  await p.evaluate(async ([base, bl]) => {
    await etat.classeur.remplacerTout(base); await relireContenu();
    const blob = async x => (await fetch("data:image/jpeg;base64," + x)).blob();
    const e = [];
    for (const x of bl) e.push({ id: x.id, nom: x.nom, precision: x.precision, numerote: !!x.numero, numero: x.numero, serie: x.serie, code: x.code, photo: await blob(x.r), verso: await blob(x.v), possede: true, recadre: true, commune: true });
    await Memoire.ecrire(e, "base");
  }, [s.base, bl]);
  // 1. Ma collection, customs en vignettes
  await p.evaluate(async () => { Collection.onglet = "Customs"; Collection.vue = "vignettes"; Collection.ouvrir(); }); await p.waitForTimeout(4000);
  // capture : seulement les figurines avec vos photos (les images du site JB ne se chargent pas ici)
  await p.evaluate(() => { document.querySelectorAll("#collection-contenu .vignette").forEach(v => { const i = v.querySelector("img.photo"); if (!i || !i.src.startsWith("blob:")) v.remove(); });
    const v = document.querySelector("#collection-bascule"); window.scrollTo(0, v.getBoundingClientRect().top + scrollY - 20); }); await p.waitForTimeout(1200);
  await p.screenshot({ path: D + "/s_collection.png" });
  // 2. fiche d'une figurine
  const nom = await p.evaluate(() => { const v = [...document.querySelectorAll("#collection-contenu .vignette")].find(x => x.querySelector("img.photo") && x.querySelector("img.photo").src.startsWith("blob:") && /\d/.test(x.querySelector(".code").textContent)); v.querySelector(".nom-court").click(); return v.querySelector(".nom-court").textContent; });
  await p.waitForTimeout(1500); await p.screenshot({ path: D + "/s_fiche.png" }); console.log("fiche :", nom);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // 3. reconnaissance d'un blister
  await p.evaluate(async () => { await Base.ouvrir(); Base._nouvelle(); }); await p.waitForTimeout(800);
  const x = bl.find(y => /DARK|LORD|TROOPER/.test(y.nom)) || bl[0];
  await p.setInputFiles("#input-base", A + x.recto);
  await p.waitForSelector("#input-base-verso", { state: "attached" });
  await p.setInputFiles("#input-base-verso", A + x.verso);
  await p.waitForFunction(() => !document.getElementById("base-fiche").hidden, null, { timeout: 120000 });
  await p.waitForTimeout(9000);
  await p.fill("#base-numero", "57"); await p.dispatchEvent("#base-numero", "input"); await p.waitForTimeout(500);
  console.log("reconnu :", await p.inputValue("#base-nom"), "|", await p.evaluate(() => $("base-identite").innerText.slice(0, 120)));
  await p.evaluate(() => { $("base-suggestions").style.display = "none"; document.querySelector("#base-recadrer-boutons").style.display = "none";
    const r = document.querySelector(".recto-verso").getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - 20); }); await p.waitForTimeout(500);
  await p.screenshot({ path: D + "/s_reco1.png" });
  await p.evaluate(() => { const r = $("base-nom").getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - 60); }); await p.waitForTimeout(500);
  await p.screenshot({ path: D + "/s_reco2.png" });
  await b.close();
})();
