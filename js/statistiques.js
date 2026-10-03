// Statistiques de la collection : totaux, répartition par onglet, complétude des séries de minifigs à
// collectionner et des catégories BrickLink commencées (figurines possédées / figurines de la catégorie),
// customs JB. Les manquantes d'une série s'ajoutent d'un appui à la liste de souhaits (js/souhaits.js).

const Statistiques = {
  async ouvrir() {
    afficher("statistiques");
    $("st-contenu").innerHTML = `<p class="aide">Calcul…</p>`;
    if (!etat.classeur) { $("st-contenu").innerHTML = `<p class="aide">Ouvrez d'abord votre collection.</p>`; return; }
    await Promise.all([Catalogue.charger().catch(() => {}), CatalogueJB.charger().catch(() => {}), Souhaits.charger()]);
    this.rendre();
  },

  async rendre() {
    const possedes = new Map(); // code -> nombre d'exemplaires
    const parOnglet = [];
    const parAffiche = new Map(); // camps Star Wars réunis sous « Star Wars »
    for (const [o, x] of Object.entries(etat.collection || {})) {
      const figs = x.cases.filter(c => c.code);
      if (figs.length) parAffiche.set(ongletAffiche(o), [...(parAffiche.get(ongletAffiche(o)) || []), ...figs]);
      for (const c of figs) possedes.set(c.code.toUpperCase(), (possedes.get(c.code.toUpperCase()) || 0) + 1);
    }
    for (const [o, figs] of parAffiche) parOnglet.push([o, figs.length, new Set(figs.map(c => c.code.toUpperCase())).size]);
    const lire = async f => { try { return await f(etat.classeur); } catch (err) { return []; } };
    const sets = await lire(lireSets), objets = await lire(lireObjets);
    const nbFigs = parOnglet.reduce((s, o) => s + o[1], 0);
    const customs = parOnglet.find(o => o[0] === THEME_CUSTOMS.onglet);
    const barre = (n, t) => `<div class="barre-avancement"><div style="width:${Math.round(100 * n / Math.max(1, t))}%"></div></div>`;

    // séries et catégories du catalogue BrickLink commencées
    const parCat = new Map();
    for (const f of Catalogue.liste || []) {
      if (!f.categorie) continue;
      const cmf = /^Collectible Minifigures/i.test(f.categorie);
      if (cmf && (!/^col/i.test(f.code) || /Other$/i.test(f.categorie))) continue; // série : les figurines seulement
      if (!parCat.has(f.categorie)) parCat.set(f.categorie, { categorie: f.categorie, cmf, figs: [] });
      parCat.get(f.categorie).figs.push(f);
    }
    const commencees = [...parCat.values()].map(c => ({ ...c, n: c.figs.filter(f => possedes.has(f.code.toUpperCase())).length }))
      .filter(c => c.n > 0).sort((a, b) => b.n / b.figs.length - a.n / a.figs.length || b.n - a.n);
    const series = commencees.filter(c => c.cmf), autres = commencees.filter(c => !c.cmf);
    this._series = series;

    const jb = CatalogueJB.liste ? CatalogueJB.liste.filter(f => f.source === "jb") : [];
    const jbPossedees = customs ? jb.filter(f => CatalogueJB.codes(f).some(k => possedes.has(k.toUpperCase()))).length : 0;

    $("st-contenu").innerHTML = `
      <div class="carte"><p class="sous-titre">📦 En résumé</p>
        <div class="ligne-valeur"><span>Figurines (exemplaires)</span><b>${nbFigs}</b></div>
        <div class="ligne-valeur"><span>Figurines différentes</span><b>${possedes.size}</b></div>
        ${customs ? `<div class="ligne-valeur"><span>dont customs</span><b>${customs[1]}</b></div>` : ""}
        <div class="ligne-valeur"><span>Sets</span><b>${sets.reduce((s, x) => s + (x.quantite || 1), 0)}</b></div>
        ${(() => { const a = sets.filter(s => !estLego(s)); if (!a.length) return "";
          const parMarque = new Map(); for (const s of a) parMarque.set(s.marque, (parMarque.get(s.marque) || 0) + (s.quantite || 1));
          return `<div class="ligne-valeur"><span>dont autres marques</span><b>${[...parMarque].map(([m, n]) => `${echapper(m)} ${n}`).join(" · ")}</b></div>`; })()}
        <div class="ligne-valeur"><span>Objets dérivés</span><b>${objets.reduce((s, x) => s + (x.quantite || 1), 0)}</b></div>
        <div class="ligne-valeur"><span>Souhaits</span><b>${Souhaits.liste.length}</b></div></div>
      <div class="carte"><p class="sous-titre">🗂️ Par onglet</p>
        ${parOnglet.sort((a, b) => b[1] - a[1]).map(([o, n, d]) => `<div class="ligne-valeur"><span><span class="pastille" style="background:${couleurOnglet(o)}"></span> ${echapper(o)}</span><b>${n}${d < n ? ` <span class="score">(${d} diff.)</span>` : ""}</b></div>`).join("")
          || `<p class="score">Aucune figurine pour l'instant.</p>`}</div>
      <div class="carte"><p class="sous-titre">🎁 Séries de minifigs à collectionner commencées (${series.length})</p>
        ${series.map((c, i) => `<div class="stat-serie"><div class="ligne-valeur"><span>${echapper(nomSerie(c.categorie))}</span><b>${c.n} / ${c.figs.length}</b></div>${barre(c.n, c.figs.length)}
          ${c.n < c.figs.length ? `<details><summary class="score">${c.figs.length - c.n} manquante(s)</summary>
            <p class="score">${c.figs.filter(f => !possedes.has(f.code.toUpperCase())).map(f => `${echapper(f.nom)} (${echapper(f.code)})`).join(" · ")}</p>
            <button class="petit" data-st-souhaits="${i}">⭐ Ajouter les manquantes à ma liste de souhaits</button></details>` : `<p class="score">✅ Série complète !</p>`}</div>`).join("")
          || `<p class="score">Aucune série commencée.</p>`}</div>
      <div class="carte"><p class="sous-titre">🧱 Catégories BrickLink commencées</p>
        ${autres.slice(0, 25).map(c => `<div class="ligne-valeur"><span>${echapper(c.categorie.replace(/\s*\/\s*/g, " · "))}</span><b>${c.n} / ${c.figs.length}</b></div>${barre(c.n, c.figs.length)}`).join("")
          || `<p class="score">Aucune.</p>`}
        ${autres.length > 25 ? `<p class="score">… et ${autres.length - 25} autre(s)</p>` : ""}</div>
      ${jb.length ? `<div class="carte"><p class="sous-titre">🎨 Customs JB Spielwaren</p>
        <div class="ligne-valeur"><span>Figurines du catalogue JB actuel que vous avez</span><b>${jbPossedees} / ${jb.length}</b></div>${barre(jbPossedees, jb.length)}</div>` : ""}`;
  },

  async souhaiterManquantes(i) {
    const c = this._series[i];
    if (!c || !etat.classeur) return;
    const possedes = new Set(Object.values(etat.collection).flatMap(o => o.cases.filter(x => x.code).map(x => x.code.toUpperCase())));
    await Souhaits.charger();
    const manquantes = c.figs.filter(f => !possedes.has(f.code.toUpperCase()) && !Souhaits.contient("Figurine", f.code));
    if (!manquantes.length) return toast("Elles sont déjà toutes dans votre liste de souhaits ⭐");
    if (!(await demander(`Ajouter ${manquantes.length} figurine(s) de « ${nomSerie(c.categorie)} » à votre liste de souhaits ?`, "Ajouter", "Annuler"))) return;
    for (const f of manquantes) await ajouterSouhait(etat.classeur, { type: "Figurine", code: f.code, nom: f.nom, theme: nomSerie(c.categorie) });
    etat.nonEnregistres++;
    await memoriser();
    await Souhaits.charger();
    toast(`⭐ ${manquantes.length} figurine(s) ajoutée(s) à votre liste de souhaits (pensez à « Enregistrer »)`, 4500);
    this.rendre();
  },
};

document.addEventListener("click", e => {
  if (e.target.closest("[data-action='statistiques']")) return Statistiques.ouvrir();
  const b = e.target.closest("[data-st-souhaits]");
  if (b) Statistiques.souhaiterManquantes(+b.dataset.stSouhaits);
});
