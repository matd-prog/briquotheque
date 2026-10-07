// Taux de reconnaissance réels (présentation) : chaque blister de la base commune (dépôt privé) re-photographié dans
// la mini-appli, rechargée à chaque fois, son empreinte retirée (pire cas : blister jamais vu par la base) ; 3 en
// parallèle ; résultats dans resultats.jsonl. Lancer : python3 -m http.server 8765 puis NODE_PATH=$(npm root -g) node …
const { chromium, devices } = require("playwright"); const fs = require("fs");
const A = "/home/user/collection-lego-prive/album_photos/";
const sortie = __dirname + "/resultats.jsonl";
const deja = new Set(fs.existsSync(sortie) ? fs.readFileSync(sortie, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l).id) : []);
const lignes = fs.readFileSync(A + "commune.tsv", "utf8").split("\n").slice(1).map(l => l.split("\t")).filter(t => t[0] && t[8] && !deja.has(t[0]));
(async () => {
  const b = await chromium.launch();
  const travail = async () => {
    const ctx = await b.newContext({ ...devices["Pixel 7"] }); const p = await ctx.newPage();
    while (lignes.length) {
      const [id, nom, precision, , , codeCat, , , recto, verso] = lignes.shift();
      const t0 = Date.now();
      try {
        // appli rechargée pour chaque blister : rien ne reste du précédent
        await p.goto("http://localhost:8765/contribuer.html"); await p.waitForTimeout(1200);
        if (await p.evaluate(() => $("dialogue").open)) await p.click("#dialogue button >> nth=0");
        await p.evaluate(async id => { window.toast = () => {}; await CatalogueJB.charger(); await CatalogueJB.chargerEmpreintes();
          // l'empreinte de ce blister retirée de la base commune (pas d'auto-reconnaissance)
          CatalogueJB.empreintes.delete(id); if (CatalogueJB.empreintesFigurine) CatalogueJB.empreintesFigurine.delete(id); Base._nouvelle(); }, id);
        await p.setInputFiles("#input-base", A + recto);
        await p.waitForFunction(() => Base._lectureRecto, null, { timeout: 30000 });
        await p.evaluate(() => Base._lectureRecto);
        if (verso) {
          await p.setInputFiles("#input-base-verso", A + verso);
          await p.waitForFunction(() => Base.versoTexte, null, { timeout: 90000 }).catch(() => {});
        }
        await p.waitForTimeout(1500);
        const r = await p.evaluate(([id, codeCat]) => {
          const attendu = CatalogueJB.trouver(id) || (codeCat && CatalogueJB.trouver(codeCat));
          const lu = Base.codeLu ? CatalogueJB.trouver(Base.codeLu) : null;
          return { nomLu: $("base-nom").value, codeLu: Base.codeLu || "", figurineOk: !!(attendu && lu && attendu === lu), attendu: attendu ? attendu.nom : "" };
        }, [id, codeCat]);
        fs.appendFileSync(sortie, JSON.stringify({ id, nom, precision, verso: !!verso, recto, ...r, s: Math.round((Date.now() - t0) / 1000) }) + "\n");
      } catch (err) { fs.appendFileSync(sortie, JSON.stringify({ id, nom, erreur: String(err.message).slice(0, 120) }) + "\n"); }
    }
    await ctx.close();
  };
  await Promise.all([travail(), travail(), travail()]);
  await b.close();
})();
