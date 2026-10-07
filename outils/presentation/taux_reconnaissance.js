// Taux de reconnaissance réels pour la présentation : chaque blister de la base commune (dépôt privé) est
// re-photographié dans la mini-appli, son empreinte retirée pendant le test (pas d'auto-reconnaissance) ;
// résultat dans resultats.jsonl (nom lu, figurine reconnue). Reprend là où il s'était arrêté.
const { chromium, devices } = require("playwright"); const fs = require("fs");
const A = "/home/user/collection-lego-prive/album_photos/";
const sortie = __dirname + "/resultats.jsonl";
const deja = new Set(fs.existsSync(sortie) ? fs.readFileSync(sortie, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l).id) : []);
const lignes = fs.readFileSync(A + "commune.tsv", "utf8").split("\n").slice(1).map(l => l.split("\t")).filter(t => t[0] && t[8]);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage();
  await p.goto("http://localhost:8765/contribuer.html"); await p.waitForTimeout(2000);
  if (await p.evaluate(() => $("dialogue").open)) await p.click("#dialogue button >> nth=0");
  await p.evaluate(async () => { await CatalogueJB.charger(); await CatalogueJB.chargerEmpreintes(); window.toast = () => {}; });
  for (const t of lignes) {
    const [id, nom, precision, , , codeCat, , , recto, verso] = t;
    if (deja.has(id)) continue;
    const t0 = Date.now();
    try {
      // l'empreinte de ce blister retirée de la base commune pendant le test (pas d'auto-reconnaissance)
      await p.evaluate(id => { window._sauve = [CatalogueJB.empreintes.get(id), CatalogueJB.empreintesFigurine && CatalogueJB.empreintesFigurine.get(id)];
        CatalogueJB.empreintes.delete(id); CatalogueJB.empreintesFigurine && CatalogueJB.empreintesFigurine.delete(id); Base._nouvelle(); }, id);
      await p.setInputFiles("#input-base", A + recto);
      await p.waitForSelector("#input-base-verso", { state: "attached" });
      if (verso) await p.setInputFiles("#input-base-verso", A + verso);
      else if (await p.isVisible("[data-action=base-passer-verso]").catch(() => false)) await p.click("[data-action=base-passer-verso]");
      await p.waitForFunction(() => !document.getElementById("base-fiche").hidden, null, { timeout: 120000 });
      if (verso) await p.waitForFunction(() => Base.versoTexte, null, { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(800);
      const r = await p.evaluate(([id, codeCat]) => {
        const attendu = CatalogueJB.trouver(id) || (codeCat && CatalogueJB.trouver(codeCat));
        const lu = Base.codeLu ? CatalogueJB.trouver(Base.codeLu) : null;
        return { nomLu: $("base-nom").value, codeLu: Base.codeLu || "", figurineOk: !!(attendu && lu && attendu === lu), attendu: attendu ? attendu.nom : "" };
      }, [id, codeCat]);
      await p.evaluate(id => { const [e, f] = window._sauve; if (e) CatalogueJB.empreintes.set(id, e); if (f && CatalogueJB.empreintesFigurine) CatalogueJB.empreintesFigurine.set(id, f); }, id);
      fs.appendFileSync(sortie, JSON.stringify({ id, nom, precision, verso: !!verso, recto, ...r, s: Math.round((Date.now() - t0) / 1000) }) + "\n");
    } catch (err) {
      fs.appendFileSync(sortie, JSON.stringify({ id, nom, erreur: String(err.message).slice(0, 120) }) + "\n");
      await p.goto("http://localhost:8765/contribuer.html"); await p.waitForTimeout(2000);
      await p.evaluate(async () => { await CatalogueJB.charger(); await CatalogueJB.chargerEmpreintes(); window.toast = () => {}; });
    }
  }
  await b.close();
})();
