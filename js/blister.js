// Lecture du nom imprimé sur un blister JB Spielwaren (reconnaissance de texte dans le téléphone,
// avec Tesseract.js inclus dans l'appli : rien n'est envoyé sur Internet).

const Blister = {
  _worker: null,

  async _lecteur() {
    if (!this._worker) {
      this._worker = await Tesseract.createWorker("eng", 1, {
        workerPath: "lib/tesseract/worker.min.js",
        corePath: "lib/tesseract/",
        langPath: "lib/tesseract/lang",
        gzip: true,
      });
    }
    return this._worker;
  },

  // Met le morceau de photo à une largeur fixe (le nom fait alors ~30 pixels de haut), en gris
  // ou en noir et blanc, avec une marge blanche : c'est ce qui se lit le mieux (essais sur blisters JB)
  _preparer(bitmap, largeur, seuil) {
    const r = largeur / bitmap.width, marge = 30;
    const cv = document.createElement("canvas");
    cv.width = Math.round(bitmap.width * r) + 2 * marge;
    cv.height = Math.round(bitmap.height * r) + 2 * marge;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bitmap, marge, marge, cv.width - 2 * marge, cv.height - 2 * marge);
    const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      if (seuil) g = g > seuil ? 255 : 0;
      p[i] = p[i + 1] = p[i + 2] = g;
    }
    ctx.putImageData(d, 0, 0);
    return cv;
  },

  // Texte lu sur le morceau de photo : plusieurs réglages, on s'arrête dès qu'une figurine JB correspond
  async lire(blob) {
    const lecteur = await this._lecteur();
    await lecteur.setParameters({ tessedit_pageseg_mode: "3" });
    const bitmap = await createImageBitmap(blob);
    let premier = "";
    for (const [largeur, seuil] of [[460, 0], [690, 0], [460, 150]]) {
      const { data } = await lecteur.recognize(this._preparer(bitmap, largeur, seuil));
      const texte = data.text || "";
      if (!premier) premier = texte;
      if (CatalogueJB.rapprocher(texte).length) return texte;
    }
    return premier;
  },

  // Photo du blister entier : le nom est cherché parmi tout le texte du carton (décor, citation...).
  // Réglages essayés dans l'ordre (essais sur blisters JB) ; on s'arrête dès qu'une figurine correspond.
  async lireEntier(blob, progression) {
    const lecteur = await this._lecteur();
    const bitmap = await createImageBitmap(blob);
    const essais = [["3", 1600, 0], ["12", 1060, 0], ["12", 1600, 150], ["3", 2000, 180]];
    let tout = "";
    for (let i = 0; i < essais.length; i++) {
      const [mode, largeur, seuil] = essais[i];
      if (progression) progression(i + 1, essais.length);
      await lecteur.setParameters({ tessedit_pageseg_mode: mode });
      const { data } = await lecteur.recognize(this._preparer(bitmap, Math.min(largeur, bitmap.width * 2), seuil));
      const texte = data.text || "";
      tout += "\n" + texte;
      if (CatalogueJB.rapprocher(texte).length) return { texte, trouve: true };
    }
    return { texte: tout, trouve: false };
  },
};

// « 189 OF 250 » -> « 189/250 »
function exemplaireDansTexte(texte) {
  const m = /\b(\d{1,4})\s*(?:of|von|\/)\s*(\d{1,4})\b/i.exec(texte || "");
  return m ? `${m[1]}/${m[2]}` : "";
}

// Garde les mots en capitales lisibles : « / j\nTHE RING ADDICT { » -> « THE RING ADDICT »
function nomDansTexte(texte) {
  const lignes = (texte || "").split("\n").map(l => (l.match(/[A-Za-z][A-Za-z'’-]{1,}/g) || []).filter(m => m.length >= 2).join(" "));
  return lignes.sort((a, b) => b.length - a.length)[0] || "";
}
