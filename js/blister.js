// Lecture du nom imprimé sur un blister JB Spielwaren (reconnaissance de texte dans le téléphone :
// rien n'est envoyé sur Internet). D'abord PaddleOCR (js/lecture_paddle.js), bien meilleur sur les
// noms en lettres grasses claires sur fond foncé ; puis Tesseract.js (inclus dans l'appli) s'il ne
// trouve rien, ou s'il ne peut pas se charger.

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
  // ou en noir et blanc, avec une marge blanche : c'est ce qui se lit le mieux (essais sur blisters JB).
  // seuil "auto" : noir et blanc au seuil calculé pour l'image (méthode d'Otsu), la couleur la plus
  // répandue devenant le fond blanc ; ainsi un texte clair sur fond gris ou foncé (ex. « SHINY DARK
  // LORD » blanc sur gris) devient noir sur blanc, seul sens que la lecture sait lire.
  _preparer(bitmap, largeur, seuil) {
    const r = largeur / bitmap.width, marge = 30;
    const cv = document.createElement("canvas");
    const l = Math.round(bitmap.width * r), h = Math.round(bitmap.height * r);
    cv.width = l + 2 * marge;
    cv.height = h + 2 * marge;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(bitmap, marge, marge, l, h);
    const d = ctx.getImageData(marge, marge, l, h), p = d.data;
    const gris = new Uint8Array(p.length / 4);
    for (let i = 0; i < gris.length; i++) gris[i] = 0.299 * p[4 * i] + 0.587 * p[4 * i + 1] + 0.114 * p[4 * i + 2];
    let s = seuil, inverser = false;
    if (seuil === "auto") {
      s = seuilOtsu(gris);
      let clairs = 0;
      for (const g of gris) if (g > s) clairs++;
      inverser = clairs < gris.length / 2;
    }
    for (let i = 0; i < gris.length; i++) {
      let g = gris[i];
      if (s) g = g > s ? 255 : 0;
      if (inverser) g = 255 - g;
      p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = g;
    }
    ctx.putImageData(d, marge, marge);
    return cv;
  },

  // Texte lu sur le morceau de photo : plusieurs réglages, on s'arrête dès qu'une figurine JB correspond.
  // Morceau plus haut que large (nom écrit à la verticale sur le carton) : essais aussi en le tournant
  // d'un quart de tour. Sans correspondance, on garde le texte où le nom paraît le plus lisible.
  async lire(blob) {
    const bitmap = await createImageBitmap(blob);
    let meilleur = "";
    try {
      const texte = (await Paddle.lignes(bitmap)).map(l => l.texte).join("\n");
      if (CatalogueJB.rapprocher(texte).length) return texte;
      meilleur = texte;
    } catch (err) { console.warn("PaddleOCR indisponible", err); }
    const lecteur = await this._lecteur();
    const sources = [bitmap];
    if (bitmap.height > 1.5 * bitmap.width) sources.push(tourner(bitmap, 90), tourner(bitmap, -90));
    for (const source of sources) {
      // mode 3 : lecture d'une page ; 11 : texte épars (lit mieux un nom dans un cadre, ex. « BLACK KRRSANTAN »)
      for (const [largeur, seuil, mode = "3"] of [[460, 0], [690, 0], [460, 150], [460, "auto"], [690, "auto"], [690, "auto", "11"]]) {
        await lecteur.setParameters({ tessedit_pageseg_mode: mode });
        const { data } = await lecteur.recognize(this._preparer(source, largeur, seuil));
        const texte = data.text || "";
        if (CatalogueJB.rapprocher(texte).length) return texte;
        if (nomProbable(texte).length > nomProbable(meilleur).length || (!meilleur.trim() && texte.trim())) meilleur = texte;
      }
    }
    return meilleur;
  },

  // Photo du blister entier : le nom est cherché parmi tout le texte du carton (décor, citation...).
  // Réglages essayés dans l'ordre (essais sur blisters JB) ; on s'arrête dès qu'une figurine correspond.
  async lireEntier(blob, progression) {
    const bitmap = await createImageBitmap(blob);
    // « auto » : noir et blanc automatique, pour un nom clair sur fond foncé
    const essais = [["3", 1600, 0], ["12", 1060, 0], ["12", 1600, 150], ["3", 2000, 180], ["3", 1600, "auto"]];
    const n = essais.length + 1;
    let tout = "";
    if (progression) progression(1, n);
    try {
      const texte = (await Paddle.lignes(bitmap)).map(l => l.texte).join("\n");
      if (CatalogueJB.rapprocher(texte).length) return { texte, trouve: true };
      tout = texte;
    } catch (err) { console.warn("PaddleOCR indisponible", err); }
    const lecteur = await this._lecteur();
    for (let i = 0; i < essais.length; i++) {
      const [mode, largeur, seuil] = essais[i];
      if (progression) progression(i + 2, n);
      await lecteur.setParameters({ tessedit_pageseg_mode: mode });
      const { data } = await lecteur.recognize(this._preparer(bitmap, Math.min(largeur, bitmap.width * 2), seuil));
      const texte = data.text || "";
      tout += "\n" + texte;
      if (CatalogueJB.rapprocher(texte).length) return { texte, trouve: true };
    }
    return { texte: tout, trouve: false };
  },
};

// Image tournée d'un quart de tour (degres = 90 ou -90), sous forme de canvas
function tourner(image, degres) {
  const cv = document.createElement("canvas");
  cv.width = image.height; cv.height = image.width;
  const ctx = cv.getContext("2d");
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.rotate(degres * Math.PI / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return cv;
}

// Seuil noir / blanc qui sépare le mieux les pixels clairs et foncés (méthode d'Otsu)
function seuilOtsu(gris) {
  const hist = new Array(256).fill(0);
  for (const g of gris) hist[g]++;
  const n = gris.length;
  let total = 0;
  for (let i = 0; i < 256; i++) total += i * hist[i];
  let sommeB = 0, poidsB = 0, meilleur = 0, seuil = 128;
  for (let t = 0; t < 256; t++) {
    poidsB += hist[t];
    if (!poidsB || poidsB === n) continue;
    sommeB += t * hist[t];
    const mB = sommeB / poidsB, mF = (total - sommeB) / (n - poidsB);
    const v = poidsB * (n - poidsB) * (mB - mF) * (mB - mF);
    if (v > meilleur) { meilleur = v; seuil = t; }
  }
  return seuil;
}

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

// Nom le plus probable parmi tout le texte d'un blister, quand il ne correspond à aucune figurine
// connue : lignes en capitales (le nom peut tenir sur deux lignes), sans les mentions habituelles
// du carton. « ZZ\nCHROME GOLDEN\nANTAGONIST\nLIMITED TO 250 » -> « CHROME GOLDEN ANTAGONIST »
function nomProbable(texte) {
  const MENTIONS = /limited|pieces|spielwaren|designed|edition|custom|minifig|www|\.de\b|\bof\b/i;
  const bonne = ligne => {
    const mots = ligne.match(/\b[A-Z][A-Z'’-]*[A-Z]\b/g) || [];
    const lettres = mots.join("").length, visibles = ligne.replace(/\s/g, "").length;
    return mots.length && mots.some(m => m.length >= 4) && lettres >= 0.8 * visibles && !MENTIONS.test(ligne)
      ? mots.join(" ") : "";
  };
  let meilleur = "", groupe = [];
  for (const ligne of [...(texte || "").split("\n").filter(l => l.trim()), ""]) {
    const b = bonne(ligne.trim());
    if (b && groupe.length < 3) { groupe.push(b); continue; }
    const nom = groupe.join(" ");
    if (nom.replace(/ /g, "").length > meilleur.replace(/ /g, "").length) meilleur = nom;
    groupe = b ? [b] : [];
  }
  // assez long pour être un nom : 8 lettres au moins, et deux mots de 3 lettres ou un mot de 8
  // (écarte les restes comme « JERE DE », lu à la place de « JB-SPIELWAREN.DE »)
  const mots = meilleur.split(" ").filter(m => m.length >= 3);
  return meilleur.replace(/ /g, "").length >= 8 && (mots.length >= 2 || (mots[0] || "").length >= 8) ? meilleur : "";
}
