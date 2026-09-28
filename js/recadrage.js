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

  async valider(entiere) { this._fin(await this._decouper(entiere)); },
  annuler() { this._fin(null); },

  installer() {
    const zone = $("recadrage-zone");
    let geste = null;
    const MIN = 0.12;
    const borner = (v, a, b) => Math.min(b, Math.max(a, v));

    zone.addEventListener("pointerdown", e => {
      const poignee = e.target.closest("[data-coin]");
      const dansCadre = e.target.closest("#recadrage-cadre");
      if (!poignee && !dansCadre) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      geste = { coin: poignee ? poignee.dataset.coin : null, x0: e.clientX, y0: e.clientY, r, depart: { ...this._cadre } };
    });
    zone.addEventListener("pointermove", e => {
      if (!geste) return;
      const dx = (e.clientX - geste.x0) / geste.r.width, dy = (e.clientY - geste.y0) / geste.r.height;
      const d = geste.depart;
      let { x, y, l, h } = d;
      if (!geste.coin) {
        x = borner(d.x + dx, 0, 1 - d.l);
        y = borner(d.y + dy, 0, 1 - d.h);
      } else {
        if (geste.coin.includes("g")) { x = borner(d.x + dx, 0, d.x + d.l - MIN); l = d.x + d.l - x; }
        if (geste.coin.includes("d")) { l = borner(d.l + dx, MIN, 1 - d.x); }
        if (geste.coin.includes("h")) { y = borner(d.y + dy, 0, d.y + d.h - MIN); h = d.y + d.h - y; }
        if (geste.coin.includes("b")) { h = borner(d.h + dy, MIN, 1 - d.y); }
      }
      this._cadre = { x, y, l, h };
      this._dessiner();
    });
    const fin = () => { geste = null; };
    zone.addEventListener("pointerup", fin);
    zone.addEventListener("pointercancel", fin);
  },
};
