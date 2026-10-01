// Consultation de la collection (lecture seule) : figurines des onglets de l'appli,
// en liste ou en planche (les étiquettes telles qu'imprimées), avec une recherche globale.

const Collection = {
  onglet: null,
  vue: "liste",
  _urls: [],
  _tour: 0, // évite qu'un ancien affichage (plus lent) remplace le plus récent

  ouvrir() {
    CatalogueJB.charger().then(() => this.rendre()).catch(() => {}); // photos des customs JB
    const onglets = Object.keys(etat.collection || {});
    if (!onglets.includes(this.onglet)) this.onglet = onglets.find(o => this._figurines(o).length) || onglets[0];
    $("collection-recherche").value = "";
    afficher("collection");
    this.rendre();
  },

  installer() {
    let minuteur;
    $("collection-recherche").addEventListener("input", () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => this.rendre(), 200);
    });
    $("collection-bascule").addEventListener("click", e => {
      const b = e.target.closest("[data-vue]");
      if (b) { this.vue = b.dataset.vue; this.rendre(); }
    });
    $("collection-onglets").addEventListener("click", e => {
      const b = e.target.closest("[data-onglet]");
      if (!b) return;
      this.onglet = b.dataset.onglet;
      $("collection-recherche").value = "";
      this.rendre();
    });
    $("collection-contenu").addEventListener("click", e => {
      if (e.target.closest("a")) return; // lien 🔗 de la fiche
      const b = e.target.closest("[data-case]");
      if (b) this._details(b.dataset.onglet, b.dataset.case);
    });
  },

  _figurines(onglet) {
    return etat.collection[onglet].cases.filter(c => c.code);
  },

  async rendre() {
    const tour = ++this._tour;
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
    const texte = $("collection-recherche").value.trim();
    const onglets = Object.keys(etat.collection);

    $("collection-onglets").innerHTML = onglets.map(o => `
      <button class="puce ${!texte && o === this.onglet ? "choisi" : ""}" data-onglet="${echapper(o)}">
        <span class="pastille" style="background:${couleurOnglet(o)}"></span>${echapper(o)} (${this._figurines(o).length})
      </button>`).join("");
    $("collection-bascule").hidden = !!texte;
    $("collection-bascule").querySelectorAll("[data-vue]").forEach(b => b.classList.toggle("choisi", b.dataset.vue === this.vue));

    const contenu = $("collection-contenu");
    if (texte) {
      const mots = normaliser(texte).split(" ").filter(Boolean);
      const res = [];
      for (const o of onglets)
        for (const c of this._figurines(o))
          if (mots.every(m => normaliser(`${c.nom} ${c.code}`).includes(m))) res.push({ ...c, onglet: o });
      const total = onglets.reduce((s, o) => s + this._figurines(o).length, 0);
      $("collection-info").textContent = res.length
        ? `${res.length} résultat(s) sur ${total} figurines.`
        : "Aucune figurine de votre collection ne correspond.";
      contenu.innerHTML = res.map(c => this._fiche(c, c.onglet)).join("");
      return;
    }

    const figs = this._figurines(this.onglet);
    if (this.vue === "liste") {
      $("collection-info").textContent = `${figs.length} figurine(s) dans « ${this.onglet} ». Touche une figurine pour en ajouter un exemplaire, ou 🔗 pour voir sa page.`;
      contenu.innerHTML = figs.map(c => this._fiche(c, this.onglet)).join("");
      return;
    }

    // Planche : la grille des cases A à E telle qu'elle sera imprimée
    $("collection-info").textContent = `Planche « ${this.onglet} » : ${figs.length} figurine(s). Touchez une case pour son détail.`;
    contenu.innerHTML = `<p class="aide">Chargement…</p>`;
    const images = await etat.classeur.imagesEtiquettes(this.onglet);
    if (tour !== this._tour) return;
    const couleur = couleurOnglet(this.onglet);
    contenu.innerHTML = `<div class="planche">${etat.collection[this.onglet].cases.map(c => {
      const image = images.get(`${c.row}:${c.col}`);
      let dedans = "";
      if (image) {
        const url = URL.createObjectURL(image);
        this._urls.push(url);
        dedans = `<img src="${url}" alt="${echapper(c.code)}">`;
      } else if (c.code) {
        dedans = `<span class="sans">${echapper(c.code)}<br>sans étiquette</span>`;
      }
      return `<button class="case" style="background:${couleur}" data-onglet="${echapper(this.onglet)}" data-case="${c.ref}"
        aria-label="${echapper(c.ref + " " + (c.nom || "case vide"))}">${dedans}</button>`;
    }).join("")}</div>`;
  },

  // Page à ouvrir : lien de la custom, ou page BrickLink ; null s'il n'y en a pas
  _lien(c, onglet) {
    if (onglet === THEME_CUSTOMS.onglet) return c.lien || null;
    return codeInvalide(c.code) ? null : urlBricklink(c.code);
  },

  // Photo d'une custom : celle du catalogue JB si on la connaît, sinon un pictogramme
  _photoCustom(c) {
    const jb = CatalogueJB.trouver(c.code);
    return jb && jb.image
      ? `<img class="photo" loading="lazy" src="${echapper(jb.image)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<span class="photo-custom">🎨</span>`;
  },

  _fiche(c, onglet) {
    return `
      <div class="fiche cliquable" data-onglet="${echapper(onglet)}" data-case="${c.ref}">
        ${onglet === THEME_CUSTOMS.onglet ? this._photoCustom(c) : imageHtml({ id: c.code }, "photo")}
        <div class="infos">
          <div class="nom-court">${echapper(c.nom || "(sans nom)")}</div>
          <div class="code">${echapper(c.code)}</div>
          <div class="lieu">${echapper(onglet)}, case ${c.ref}${c.image ? "" : " · sans étiquette"}</div>
        </div>
        ${liensFiche(this._lien(c, onglet), "Voir la page")}
      </div>`;
  },

  // Figurine touchée : petit menu (exemplaire de plus sans reprendre de photo, page BrickLink ou du fabricant)
  async _details(onglet, ref) {
    const c = etat.collection[onglet].cases.find(x => x.ref === ref);
    if (!c || !c.code) { toast(`Case ${ref} : vide.`); return; }
    const n = ouFigurine(c.code).length, lien = this._lien(c, onglet);
    const actions = ["➕ Ajouter un exemplaire" + (onglet === THEME_CUSTOMS.onglet ? " (nouveau n°)" : "")];
    if (lien) actions.push(onglet === THEME_CUSTOMS.onglet ? "🔗 Voir la page" : "🔗 Voir sur BrickLink");
    const i = await choisirAction(`${c.nom || "(sans nom)"}\n${c.code} · ${onglet}, case ${ref}${n > 1 ? `\n${n} exemplaires dans ta collection` : ""}`, actions);
    if (i === 0) exemplaireEnPlus(c, onglet);
    else if (i === 1) {
      const l = lienOuvrable(lien);
      if (l.startsWith("intent:")) location.href = l; else window.open(l, "_blank", "noopener");
    }
  },
};
