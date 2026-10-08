// Écran de recadrage : un cadre à déplacer (glisser au milieu) et à redimensionner
// (glisser un coin) pour ne garder que la figurine avant l'identification.

const Recadrage = {
  _cadre: { x: 0.1, y: 0.05, l: 0.8, h: 0.9 }, // en fraction de l'image affichée

  // Affiche l'écran de recadrage ; renvoie le morceau de photo choisi (Blob JPEG), ou null si annulé
  ouvrir(fichier) {
    return new Promise((ok, ko) => {
      const img = $("recadrage-image");
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        this._cadre = { x: 0.1, y: 0.05, l: 0.8, h: 0.9 };
        this._dessiner();
      };
      img.onerror = () => ko(new Error("photo illisible"));
      img.src = url;
      afficher("recadrage");
      this._fin = resultat => { URL.revokeObjectURL(url); ok(resultat); };
    });
  },

  _dessiner() {
    const c = this._cadre, el = $("recadrage-cadre");
    el.style.left = c.x * 100 + "%";
    el.style.top = c.y * 100 + "%";
    el.style.width = c.l * 100 + "%";
    el.style.height = c.h * 100 + "%";
  },

  // Découpe la zone choisie dans la photo en pleine résolution
  _decouper(entiere) {
    const img = $("recadrage-image");
    const c = entiere ? { x: 0, y: 0, l: 1, h: 1 } : this._cadre;
    const W = img.naturalWidth, H = img.naturalHeight;
    const sx = Math.round(c.x * W), sy = Math.round(c.y * H);
    const sw = Math.max(1, Math.round(c.l * W)), sh = Math.max(1, Math.round(c.h * H));
    const r = Math.min(1, 1280 / Math.max(sw, sh));
    const cv = document.createElement("canvas");
    cv.width = Math.round(sw * r); cv.height = Math.round(sh * r);
    cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.9));
  },

  // Photo réduite (1280 px au plus), en JPEG, sans recadrage
  reduire(fichier) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        cv.toBlob(b => b ? ok(b) : ko(new Error("photo illisible")), "image/jpeg", 0.88);
      };
      img.onerror = () => ko(new Error("photo illisible"));
      img.src = URL.createObjectURL(fichier);
    });
  },

  async valider(entiere) { this._fin(await this._decouper(entiere)); },
  annuler() { this._fin(null); },

  installer() {
    // gestes : coin ou bord le plus proche du doigt, loupe (js/cadre_tactile.js)
    CadreTactile.installer($("recadrage-zone"), () => this._cadre, c => { this._cadre = c; this._dessiner(); }, 0.12);
  },
};
