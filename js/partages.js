// Partager avec un ami, sans aucune valeur (Mathias, 07/11/2026) : « toute la collection, pour que des amis puissent la
// voir, sans pouvoir faire d'action » et « un fichier des doubles à échanger […] sans aucune notion de valeur ».
//  - deux fichiers Excel à envoyer à qui l'on veut (Messages, WhatsApp, Mail…) : « Ma collection » et « Mes doubles » ;
//  - ou partage dans l'appli avec un ami (table partages_amis, outils/supabase_partages.sql) : lui seul le voit, en
//    lecture seule (recherche, rien à modifier) ; pour les doubles, il voit ceux qui sont dans sa liste de souhaits et
//    peut proposer un échange.
// Jamais de prix, de valeur, de prix payé ni de photo : catégorie, thème, nom, code, n°, état, quantité.

const Partages = {
  get client() { return typeof Compte !== "undefined" ? Compte.client : null; },
  get moi() { return typeof Compte !== "undefined" && Compte.session ? Compte.session.user.id : null; },
  TITRES: { collection: "📚 Collection", doubles: "🔁 Doubles à échanger" },

  // Contenu sans valeur : [{ c: catégorie, t: thème, n: nom, k: code, d: détail (n°, état…), q: quantité, cle }]
  async contenu(sorte) {
    if (!etat.classeur) throw new Error("ouvrez d'abord votre collection");
    if (sorte === "doubles") {
      const exclus = Echanges._exclus(), doubles = (await Echanges.doubles()).filter(d => !exclus.has(d.cle));
      return doubles.map(d => ({ c: d.type, n: d.nom, k: d.type === "Custom" || d.code === "CUSTOM" ? "" : d.code, d: d.numeros ? `n° ${d.numeros}` : "", q: d.quantite, cle: d.cle }));
    }
    const res = [], numero = nom => (/(\d+\s*\/\s*\d+)\s*$/.exec(nom || "") || [, ""])[1].replace(/\s/g, "");
    for (const [onglet, o] of Object.entries(etat.collection || {}))
      for (const c of o.cases.filter(c => c.code || c.nom)) {
        const custom = onglet === THEME_CUSTOMS.onglet;
        res.push({ c: custom ? "Custom" : "Figurine", t: typeof ongletAffiche === "function" ? ongletAffiche(onglet) : onglet,
                   n: custom ? Collection._sansNumero(c.nom) : (c.nom || c.code), k: custom ? "" : c.code, d: custom && numero(c.nom) ? `n° ${numero(c.nom)}` : "", q: 1 });
      }
    const lire = async f => { try { return await f(etat.classeur); } catch (err) { return []; } };
    for (const s of await lire(lireSets)) res.push({ c: "Set", t: s.marque && s.marque !== "LEGO" ? s.marque : (s.theme || "LEGO"), n: s.nom || s.code, k: s.code, d: [s.annee, s.etat].filter(Boolean).join(" · "), q: s.quantite || 1 });
    for (const o of await lire(lireObjets)) res.push({ c: "Objet dérivé", t: o.type || "", n: o.nom || o.code, k: o.code || "", d: o.etat || "", q: o.quantite || 1 });
    if (typeof lireObjetsJB === "function") for (const o of await lire(lireObjetsJB)) res.push({ c: "Objet JB", t: o.type || "", n: o.nom, k: "", d: "", q: o.quantite || 1 });
    return res;
  },
  // figurines d'une même référence regroupées (customs : un exemplaire par n°, donc regroupées avec leurs n°)
  _regrouper(l) {
    const m = new Map();
    for (const x of l) {
      const k = [x.c, x.t, x.n, x.k].join("|");
      const g = m.get(k) || { ...x, q: 0, nums: [] };
      g.q += x.q || 1; if (x.d && /^n° /.test(x.d)) g.nums.push(x.d.slice(3)); else if (x.d) g.d = x.d;
      m.set(k, g);
    }
    return [...m.values()].map(g => ({ ...g, d: g.nums.length ? `n° ${g.nums.join(", ")}` : g.d || "" }))
      .sort((a, b) => a.c.localeCompare(b.c, "fr") || String(a.t).localeCompare(String(b.t), "fr") || a.n.localeCompare(b.n, "fr"));
  },

  // Fichier Excel (sans valeur), envoyé par le menu Partager du téléphone, sinon téléchargé
  async fichier(sorte, liste = null, nomPersonne = "") {
    try {
      const l = this._regrouper(liste || await this.contenu(sorte));
      if (!l.length) { await demander(sorte === "doubles" ? "Aucun double à mettre dans le fichier (Échanges : « Je garde n exemplaire(s) »)." : "Votre collection est vide.", "OK", "Fermer"); return; }
      const feuille = sorte === "doubles"
        ? { nom: "Doubles", titre: "Doubles", colonnes: [["Type", 10], ["Nom", 48], ["Code", 14], ["Exemplaires en double", 12], ["N° disponibles", 30]],
            lignes: l.map(x => [x.c, x.n, x.k, x.q, x.d.replace(/^n° /, "")]) }
        : { nom: "Collection", titre: "Collection", colonnes: [["Catégorie", 13], ["Thème / marque", 20], ["Nom", 48], ["Code", 14], ["Détail (n°, état…)", 30], ["Quantité", 9]],
            lignes: l.map(x => [x.c, x.t || "", x.n, x.k, x.d, x.q]) };
      const qui = (nomPersonne || (Compte.profil && Compte.profil.pseudo) || "").replace(/[^\w-]+/g, "_");
      const nom = `${sorte === "doubles" ? "doubles_a_echanger" : "collection"}${qui ? "_" + qui : ""}_${horodatage()}.xlsx`;
      const f = new File([await creerXlsx([feuille])], nom, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: sorte === "doubles" ? "Mes doubles à échanger" : "Ma collection" }); return; }
        catch (err) { if (err.name === "AbortError") return; }
      }
      Exports._telecharger(f, nom);
    } catch (err) { console.error(err); await demander("Fichier impossible : " + err.message, "OK", "Fermer"); }
  },

  // Partage dans l'appli avec un ami (choisi dans la liste, ou donné)
  async partager(sorte, ami = null) {
    if (!this.client || !this.moi) { await demander("Connectez-vous d'abord à votre compte (👤 en haut de l'écran).", "OK", "Fermer"); return; }
    if (!ami) {
      await Amis.charger();
      const amis = Amis.liste.filter(a => a.sens === "ami");
      if (!amis.length) { await demander("Vous n'avez pas encore d'ami dans l'appli : ajoutez-en un dans « 👥 Mes amis ».", "OK", "Fermer"); return; }
      const i = await choisirAction(`${sorte === "doubles" ? "Partager mes doubles" : "Partager ma collection"} avec…`, amis.map(a => `👤 ${a.pseudo}`));
      if (i < 0) return;
      ami = amis[i];
    }
    const contenu = await this.contenu(sorte).catch(err => { demander("Partage impossible : " + err.message, "OK", "Fermer"); return null; });
    if (!contenu) return;
    const { error } = await this.client.from("partages_amis")
      .upsert({ de: this.moi, a: ami.ami, sorte, contenu, cree_le: new Date().toISOString() }, { onConflict: "de,a,sorte" });
    if (error) { await demander("Partage impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast(`${sorte === "doubles" ? `${contenu.length} double(s)` : `Votre collection (${contenu.length} article(s))`} partagé(s) avec ${ami.pseudo} ✔ Sans aucune valeur.`, 5000);
    if (ecranActuel === "amis") Amis.rendre();
  },
  // depuis « 👥 Mes amis » : que partager avec cet ami ?
  async partagerAvec(ami) {
    const i = await choisirAction(`Partager avec ${ami.pseudo} (sans aucune valeur)`, ["📚 Toute ma collection, à regarder", "🔁 Mes doubles à échanger"]);
    if (i >= 0) this.partager(i ? "doubles" : "collection", ami);
  },

  // partages reçus et envoyés : [{ id, de, a, sorte, contenu, cree_le }]
  async lister() {
    if (!this.client || !this.moi) return { recus: [], envoyes: [] };
    const { data, error } = await this.client.from("partages_amis").select("id, de, a, sorte, cree_le, nb:contenu").order("cree_le", { ascending: false });
    if (error) return { recus: [], envoyes: [], erreur: error };
    const l = (data || []).map(p => ({ ...p, nb: Array.isArray(p.nb) ? p.nb.length : 0 }));
    return { recus: l.filter(p => p.a === this.moi), envoyes: l.filter(p => p.de === this.moi) };
  },
  async retirer(id) {
    if (!(await demander("Retirer ce partage ? L'ami ne le verra plus.", "Retirer", "Annuler"))) return;
    const { error } = await this.client.from("partages_amis").delete().eq("id", id);
    if (error) { await demander("Impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    Amis.rendre();
  },

  // Écran de lecture seule : la collection (ou les doubles) d'un ami
  async voir(id, pseudo) {
    const { data, error } = await this.client.from("partages_amis").select("*").eq("id", id).maybeSingle();
    if (error || !data) { await demander("Ce partage n'est plus disponible.", "OK", "Fermer"); return; }
    this.vu = { ...data, pseudo, liste: this._regrouper(data.contenu || []) };
    this.vu.souhaits = new Set();
    if (data.sorte === "doubles" && typeof Echanges !== "undefined" && etat.classeur)
      try { this.vu.souhaits = new Set((await Echanges.souhaits()).map(s => s.cle)); } catch (err) { /* sans liste de souhaits */ }
    afficher("partage");
    $("partage-recherche").value = "";
    this.rendreVu();
  },
  rendreVu() {
    const v = this.vu;
    if (!v) return;
    const q = normaliser($("partage-recherche").value || "");
    const l = v.liste.filter(x => !q || normaliser(`${x.n} ${x.k} ${x.t} ${x.d}`).includes(q));
    const voulus = v.sorte === "doubles" ? v.liste.filter(x => x.cle && v.souhaits.has(x.cle)).length : 0;
    $("partage-titre").innerHTML = `${v.sorte === "doubles" ? "🔁 Doubles à échanger" : "📚 Collection"} de <b>${echapper(v.pseudo)}</b>
      <span class="score">· partagé le ${echapper(new Date(v.cree_le).toLocaleDateString("fr-FR"))} · ${v.liste.length} référence(s)</span>`;
    $("partage-actions").innerHTML = v.sorte === "doubles"
      ? `${voulus ? `<p class="alerte info">⭐ ${voulus} de ses doubles sont dans votre liste de souhaits.</p>` : ""}
         <button class="gros-bouton vert" data-partage-proposer>✉️ Proposer un échange à ${echapper(v.pseudo)}</button>` : "";
    let cat = "";
    $("partage-liste").innerHTML = l.map(x => {
      const titre = x.c !== cat ? `<p class="sous-titre">${echapper(x.c)}</p>` : ""; cat = x.c;
      const voulu = v.sorte === "doubles" && x.cle && v.souhaits.has(x.cle);
      return `${titre}<div class="ligne-valeur"><span>${voulu ? "⭐ " : ""}${echapper(x.n)} <span class="score">${[x.k, x.t, x.d].filter(Boolean).map(echapper).join(" · ")}</span></span>${x.q > 1 ? `<b>×${x.q}</b>` : ""}</div>`;
    }).join("") || `<p class="aide">Rien ne correspond.</p>`;
  },
  // proposer un échange à partir des doubles qu'il a partagés (écran de proposition des Échanges)
  proposer() {
    const v = this.vu;
    if (!v || typeof Echanges === "undefined") return;
    Promise.all([Echanges.doubles(), Echanges.souhaits()]).then(([doubles, souhaits]) => {
      const mes = new Set(souhaits.map(s => s.cle)), exclus = Echanges._exclus();
      Echanges.partenaire = Echanges._preparer({ user_id: v.de, pseudo: v.pseudo, libre: true,
        il_a: (v.contenu || []).map(x => ({ cle: x.cle, nom: x.n, code: x.k, quantite: x.q, numeros: (x.d || "").replace(/^n° /, ""), voulu: mes.has(x.cle) }))
          .sort((a, b) => b.voulu - a.voulu || a.nom.localeCompare(b.nom, "fr")),
        il_cherche: doubles.filter(d => !exclus.has(d.cle)).map(d => ({ ...d, voulu: false })) });
      Echanges.vue = "proposer";
      afficher("echanges"); Echanges.rendre();
    });
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-partage-fichier], [data-partage-partager], [data-partage-voir], [data-partage-retirer], [data-partage-avec], [data-partage-proposer], [data-partage-fichier-vu]");
  if (!b) return;
  if (b.dataset.partageFichier) Partages.fichier(b.dataset.partageFichier);
  else if (b.dataset.partagePartager) Partages.partager(b.dataset.partagePartager);
  else if (b.dataset.partageVoir) Partages.voir(+b.dataset.partageVoir, b.dataset.partagePseudo || "");
  else if (b.dataset.partageRetirer) Partages.retirer(+b.dataset.partageRetirer);
  else if (b.dataset.partageAvec) Partages.partagerAvec({ ami: b.dataset.partageAvec, pseudo: b.dataset.partagePseudo || "" });
  else if (b.hasAttribute("data-partage-proposer")) Partages.proposer();
  else if (b.hasAttribute("data-partage-fichier-vu") && Partages.vu) Partages.fichier(Partages.vu.sorte, Partages.vu.contenu, Partages.vu.pseudo);
});
document.addEventListener("input", e => { if (e.target.id === "partage-recherche") Partages.rendreVu(); });
