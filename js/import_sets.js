// Import d'une liste de sets tenue dans un autre fichier Excel (export BrickLink / Brickset ou liste faite à la main) :
// dans chaque onglet, une ligne de titres avec au moins le numéro (Number, Numéro…) ; nom, thème et remarques facultatifs.
// Les remarques (« boite à plat », « boite + set (sans fig) », « scellé »…) donnent l'état ; le nom de l'onglet (Carton 1…)
// est gardé comme rangement. Les minifigurines de séries (71005 « Homer Simpson ») sont retrouvées par leur nom.

const ImportSets = {
  // Colonnes reconnues d'après leur titre
  _colonnes(cellules) {
    const trouver = re => Object.keys(cellules).find(c => re.test(normaliser(cellules[c])));
    const numero = trouver(/^(number|numero|n°|no|set|set number|numero du set|ref(erence)?)$/);
    if (!numero) return null;
    return { numero, nom: trouver(/^(setname|set name|name|nom|nom du set|description)$/),
             theme: trouver(/^(theme|serie)$/), note: trouver(/^(usernotes|user notes|notes?|remarques?|etat|commentaires?)$/) };
  },

  // Lignes des onglets du fichier : [{ numero, nom, theme, note, onglet }]
  async lire(octets) {
    const cl = await Classeur.ouvrir(octets), res = [];
    for (const f of cl.feuilles) {
      let col = null;
      for (const { cellules } of await cl.lignes(f.nom)) {
        if (!col) { col = this._colonnes(cellules); continue; }
        const numero = (cellules[col.numero] || "").replace(/\s+/g, "");
        if (!/^\d{3,}(-\d+)?$/.test(numero)) continue;
        res.push({ numero, nom: cellules[col.nom] || "", theme: cellules[col.theme] || "", note: cellules[col.note] || "", onglet: f.nom });
      }
    }
    return res;
  },

  // Remarque -> état, boîte, notice, quantité
  _etat(note) {
    const n = normaliser(note);
    const nombre = +((/^(\d+)\s*boites?/.exec(n) || [])[1] || 1);
    if (/scell/.test(n)) return { etat: "Neuf scellé", boite: true, notice: true, quantite: 1 };
    if (/\bset\b/.test(n) && /sans\s*fig/.test(n)) return { etat: "Sans figurines", boite: /boite/.test(n) || null, notice: null, quantite: 1 };
    if (/\bset\b/.test(n)) return { etat: /boite/.test(n) ? "Démonté (en boîte)" : "Monté", boite: /boite/.test(n) || null, notice: null, quantite: 1 };
    // « boite », « boite à plat » seuls : le set (monté, exposé) ET sa boîte rangée à part (précisé par l'utilisateur)
    if (/boite/.test(n)) return { etat: "Monté", boite: true, notice: null, quantite: nombre };
    return { etat: "", boite: null, notice: null, quantite: 1 };
  },

  // Figurines d'une série à collectionner : 71005 -> [71005-1, 71005-2…]
  _serie(numero) {
    const n = numero.replace(/-\d+$/, ""), res = [];
    for (let v = 1; v <= 40; v++) { const s = CatalogueSets.sets.get(`${n}-${v}`); if (s) res.push(s); }
    return res.length > 1 && res.every(s => /^Collectible Minifigures/.test(s.theme)) ? res : [];
  },

  _mots(t) {
    return new Set(normaliser(t).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(m => m.length > 1 && !["the", "and", "with", "of"].includes(m)));
  },

  // Figurine de la série dont le nom ressemble le plus (« Waylon Smithers » -> « Smithers »)
  _figurineSerie(serie, nom, prises) {
    const a = this._mots(nom);
    let meilleur = null, score = 0, egalite = false;
    for (const s of serie) {
      // mot commun, ou l'un commence par l'autre (« Bartman » / « Bart ») ; à égalité, le plus de mots communs l'emporte
      const b = [...this._mots(s.nom)];
      const communs = [...a].filter(m => b.some(x => x === m || (Math.min(x.length, m.length) >= 4 && (x.startsWith(m) || m.startsWith(x))))).length;
      const r = communs / Math.max(1, Math.min(a.size, b.length)) + communs / 100 - (prises.has(s.code) ? 0.5 : 0);
      if (r > score) { meilleur = s; score = r; egalite = false; }
      else if (r === score) egalite = true;
    }
    return score >= 0.5 && !egalite ? meilleur : null;
  },

  _figurines(code) {
    return (CatalogueSets.figurines.get(code.toLowerCase()) || [])
      .map(f => (f.bricklink && f.ressemblance >= 0.6 ? f.bricklink.toLowerCase() : f.nom) + (f.quantite > 1 ? ` ×${f.quantite}` : "")).join(", ");
  },

  // Lignes lues -> sets à ajouter (+ ce qui n'a pas été reconnu)
  analyser(lignes) {
    const sets = [], inconnus = [], ignores = [], prises = new Set();
    const numeros = lignes.map(l => l.numero.replace(/-\d+$/, ""));
    const ajouter = (s, l, extra = {}) => {
      const e = this._etat(l.note);
      if (!e.etat && s.cmf) e.etat = "Monté";
      sets.push({ code: s.code, nom: s.nom, annee: s.annee || "", theme: s.theme || "", pieces: s.pieces || "", ...e,
                  figurines: s.cmf ? "" : this._figurines(s.code),
                  remarques: [l.note, l.onglet, extra.remarque].filter(Boolean).join(" · ") });
    };
    lignes.forEach((l, i) => {
      const serie = /-\d+$/.test(l.numero) ? [] : this._serie(l.numero);
      if (serie.length) {
        if (/complete|complet/i.test(l.nom)) {
          // série complète : déjà détaillée figurine par figurine dans la liste, ou à détailler
          if (numeros.filter(n => n === numeros[i]).length > 1) { ignores.push(`${l.numero} « ${l.nom} » (figurines déjà listées une par une)`); return; }
          for (const s of serie) ajouter({ ...s, cmf: true }, l, { remarque: "série complète" });
          return;
        }
        const s = this._figurineSerie(serie, l.nom, prises);
        if (s) { prises.add(s.code); ajouter({ ...s, cmf: true }, l); }
        else { inconnus.push(`${l.numero} « ${l.nom} »`); ajouter({ code: l.numero, nom: l.nom, theme: l.theme }, l, { remarque: "figurine de la série à préciser" }); }
        return;
      }
      const s = CatalogueSets.trouver(l.numero);
      if (s) ajouter(s, l);
      else { inconnus.push(`${l.numero} « ${l.nom} »`); ajouter({ code: l.numero, nom: l.nom, theme: l.theme }, l, { remarque: "absent du catalogue" }); }
    });
    return { sets, inconnus, ignores };
  },

  async importer(fichier) {
    try {
      await CatalogueSets.charger();
      const lignes = await this.lire(await fichier.arrayBuffer());
      if (!lignes.length) { await demander("Aucun numéro de set trouvé : il faut une colonne titrée « Number » ou « Numéro ».", "OK", "Fermer"); return; }
      const { sets, inconnus, ignores } = this.analyser(lignes);
      // déjà importés (même numéro et mêmes remarques) : pas de doublon si on importe deux fois le même fichier
      // déjà importés (même numéro et mêmes remarques) : pas de doublon si on importe deux fois le même fichier ;
      // leur état est seulement mis à jour s'il a changé (nouvelle règle de lecture des remarques)
      const existants = new Map((await lireSets(etat.classeur)).map(s => [`${s.code.toLowerCase()}|${s.remarques || ""}`, s]));
      const nouveaux = sets.filter(s => !existants.has(`${s.code.toLowerCase()}|${s.remarques}`));
      const aCorriger = sets.map(s => [s, existants.get(`${s.code.toLowerCase()}|${s.remarques}`)])
        .filter(([s, e]) => e && s.etat && e.etat !== s.etat);
      const compte = e => sets.filter(s => s.etat === e && !/^Collectible/.test(s.theme)).length;
      const ok = await demander(`${lignes.length} lignes lues dans « ${fichier.name} ».\n\n` +
        `${sets.length} articles : ${compte("Monté")} montés (boîte à part), ${compte("Démonté (en boîte)")} en boîte, ` +
        `${compte("Sans figurines")} sans figurines, ${compte("Neuf scellé")} scellés, ` +
        `${sets.filter(s => /^Collectible/.test(s.theme)).length} minifigurines de séries…` +
        (sets.length > nouveaux.length ? `\n${sets.length - nouveaux.length} déjà dans votre onglet « Sets »` +
          (aCorriger.length ? `, dont ${aCorriger.length} dont l'état sera corrigé.` : " (inchangés).") : "") +
        (inconnus.length ? `\n\nNon reconnus (ajoutés tels quels, à vérifier) :\n${inconnus.slice(0, 10).join("\n")}${inconnus.length > 10 ? "\n…" : ""}` : "") +
        (ignores.length ? `\n\nIgnorés :\n${ignores.join("\n")}` : "") +
        `\n\n${nouveaux.length ? `Ajouter ${nouveaux.length} articles` : "Aucun nouvel article"}` +
        `${aCorriger.length ? ` et corriger ${aCorriger.length} états` : ""} ?`, "Valider", "Annuler");
      if (!ok || !(nouveaux.length + aCorriger.length)) return;
      afficher("chargement");
      for (const [s, e] of aCorriger) {
        await etat.classeur.ecrireTexte(ONGLET_SETS, "F" + e.row, s.etat);
        if (s.boite != null) await etat.classeur.ecrireTexte(ONGLET_SETS, "G" + e.row, s.boite ? "oui" : "non");
      }
      if (aCorriger.length) etat.nonEnregistres++;
      for (let i = 0; i < nouveaux.length; i++) {
        $("texte-chargement").textContent = `Ajout des sets… (${i + 1} sur ${nouveaux.length})`;
        await ajouterSet(etat.classeur, nouveaux[i]);
        etat.nonEnregistres++;
      }
      await memoriser();
      await relireContenu();
      afficher("accueil");
      await demander(`${nouveaux.length} article(s) ajouté(s)${aCorriger.length ? `, ${aCorriger.length} état(s) corrigé(s)` : ""} dans l'onglet « Sets ».\n\nPensez à enregistrer le fichier.`, "OK", "Fermer");
    } catch (err) {
      console.error(err);
      const m = await Memoire.lire(); // retour à la dernière version gardée dans le téléphone
      if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
      afficher("set");
      await demander("L'import a échoué : " + err.message, "OK", "Fermer");
    }
  },
};

$("input-import-sets").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) ImportSets.importer(f);
});
