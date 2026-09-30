// Consulter la base des figurines JB : catalogue JB Spielwaren (en vente), figurines retirées (brickshellcases,
// archives, eBay.de), blisters photographiés par des collectionneurs (code ALB-…), et « mes photos » de blisters
// (album_photos/ du dépôt privé, lues avec le jeton GitHub de l'écran Valeur : elles ne sont pas publiées).

const Consulter = {
  PAR_PAGE: 60,
  affichees: 0,
  resultats: [],
  mesPhotos: null,   // Map code -> [chemins], depuis album_photos/blisters.tsv du dépôt privé
  _images: new Map(), // chemin -> URL locale (blob) déjà téléchargée

  async ouvrir() {
    afficher("consulter");
    $("consulter-info").textContent = "Chargement de la base…";
    try { await CatalogueJB.charger(); } catch (err) { $("consulter-info").textContent = "Base JB indisponible (réseau ?)."; return; }
    await this._chargerMesPhotos();
    this.lister();
  },

  async _chargerMesPhotos() {
    if (this.mesPhotos) return;
    try {
      Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github");
      if (!Valeur.jeton) return;
      const rep = await Valeur._api("/contents/album_photos/blisters.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) return;
      this.mesPhotos = new Map();
      for (const l of (await rep.text()).split("\n").slice(1)) {
        const [photo, nom, numero, code] = l.split("\t");
        if (!photo || !code) continue;
        const k = code.toUpperCase();
        if (!this.mesPhotos.has(k)) this.mesPhotos.set(k, []);
        this.mesPhotos.get(k).push({ photo, nom, numero });
      }
    } catch (err) { console.warn(err); }
  },

  _source(f) {
    return f.source === "jb" && f.epuisee ? `Épuisée chez JB${f.prix ? ` (était à ${f.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })})` : ""}`
      : f.source === "jb" ? (f.prix ? `En vente chez JB · ${f.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : "Catalogue JB")
      : f.source === "album" ? "Photo de collectionneur" : f.source === "brickshell" ? "Retirée · brickshellcases"
      : f.source === "archive" ? "Retirée · archives" : "Retirée · eBay.de";
  },

  lister() {
    const q = $("consulter-recherche").value.trim(), filtre = $("consulter-filtre").value;
    let liste = q ? CatalogueJB.chercher(q, 100000) : CatalogueJB.liste.slice();
    const mes = f => this.mesPhotos && this.mesPhotos.has(f.code.toUpperCase());
    if (filtre === "jb") liste = liste.filter(f => f.source === "jb" && !f.epuisee);
    else if (filtre === "retirees") liste = liste.filter(f => f.epuisee || ["brickshell", "archive", "ebay"].includes(f.source));
    else if (filtre === "album") liste = liste.filter(f => f.source === "album");
    else if (filtre === "mes") liste = liste.filter(mes);
    // blisters avec photo d'abord, puis par nom
    const aPhoto = f => !!f.image || mes(f);
    liste.sort((a, b) => aPhoto(b) - aPhoto(a) || a.nom.localeCompare(b.nom));
    this.resultats = liste; this.affichees = 0;
    $("consulter-liste").innerHTML = "";
    const n = liste.length;
    $("consulter-info").textContent = `${n} figurine${n > 1 ? "s" : ""}` + (this.mesPhotos ? `, dont ${liste.filter(mes).length} avec vos photos (📷)` :
      filtre === "mes" ? " : enregistrez votre jeton GitHub (écran Valeur) pour voir vos photos." : "");
    this.suite();
  },

  suite() {
    const lot = this.resultats.slice(this.affichees, this.affichees + this.PAR_PAGE);
    const mes = f => (this.mesPhotos && this.mesPhotos.get(f.code.toUpperCase())) || [];
    const html = lot.map(f => {
      const photos = mes(f);
      const lien = f.lien ? `href="${echapper(f.lien)}" target="_blank" rel="noopener"` : "";
      return `<a class="proposition" ${lien}>
        ${f.image && !(photos.length && $("consulter-filtre").value === "mes") ? `<img src="${echapper(f.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
          : photos.length ? `<img data-photo="${echapper(photos[0].photo)}" alt="">` : `<div class="sans-photo">Pas de photo</div>`}
        <span class="nom-court">${echapper(f.nom)}</span>
        <span class="score">${echapper(this._source(f))}${photos.length ? ` · 📷 ${photos.length}` : ""}</span>
      </a>`;
    }).join("");
    $("consulter-liste").insertAdjacentHTML("beforeend", html);
    this.affichees += lot.length;
    $("consulter-plus").hidden = this.affichees >= this.resultats.length;
    this._chargerImages();
  },

  // Photos du dépôt privé : téléchargées une à une avec le jeton (pas d'adresse publique)
  async _chargerImages() {
    for (const img of $("consulter-liste").querySelectorAll("img[data-photo]:not([src])")) {
      const chemin = img.dataset.photo;
      try {
        if (!this._images.has(chemin)) {
          const rep = await Valeur._api(`/contents/album_photos/${chemin}`, { headers: { Accept: "application/vnd.github.raw" } });
          if (!rep.ok) continue;
          this._images.set(chemin, URL.createObjectURL(await rep.blob()));
        }
        img.src = this._images.get(chemin);
      } catch (err) { console.warn(err); }
    }
  },
};

if ($("consulter-recherche")) {
  let minuteur;
  $("consulter-recherche").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => Consulter.lister(), 250); });
  $("consulter-filtre").addEventListener("change", () => Consulter.lister());
  $("consulter-plus").addEventListener("click", () => Consulter.suite());
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (b && b.dataset.action === "consulter") Consulter.ouvrir();
});
