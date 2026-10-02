// Lecture de texte « PaddleOCR » dans le téléphone (rien n'est envoyé sur Internet) : moteur
// onnxruntime-web et modèles PP-OCRv4 (repérage des zones de texte, puis lecture de chaque zone),
// dans lib/paddle/. Bien meilleure que Tesseract sur les noms des blisters JB en lettres grasses,
// claires sur fond foncé, encadrées ou écrites à la verticale (essais du 29/09/2026).
// Le modèle de lecture a été réduit aux caractères latins (outils/modele_paddle.py).
// Environ 27 Mo téléchargés à la première lecture (moteur 14 Mo, modèles 12 Mo), gardés ensuite par le téléphone.

const Paddle = {
  _pret: null,

  charger() {
    if (!this._pret) {
      this._pret = (async () => {
        if (typeof ort === "undefined") await new Promise((ok, ko) => {
          const s = document.createElement("script");
          s.src = "lib/paddle/ort.wasm.min.js";
          s.onload = ok; s.onerror = () => ko(new Error("moteur de lecture absent"));
          document.head.appendChild(s);
        });
        ort.env.wasm.numThreads = 1; // plusieurs fils demandent des en-têtes que GitHub Pages n'envoie pas
        ort.env.wasm.wasmPaths = new URL("lib/paddle/", location.href).href;
        const [det, rec, cles] = await Promise.all([
          ort.InferenceSession.create("lib/paddle/det.onnx"),
          ort.InferenceSession.create("lib/paddle/rec.onnx"),
          fetch("lib/paddle/cles.txt").then(r => { if (!r.ok) throw new Error("cles.txt absent"); return r.text(); }),
        ]);
        this.det = det; this.rec = rec;
        this.cles = ["", ...cles.split("\n"), " "]; // 0 : « blanc » du décodage ; dernier : espace
      })().catch(err => { this._pret = null; throw err; });
    }
    return this._pret;
  },

  // Pixels d'une image (ou d'un morceau) redimensionnée, en tenseur [1, 3, h, l] normalisé (-1 à 1),
  // canaux dans l'ordre bleu, vert, rouge comme à l'entraînement des modèles
  _tenseur(image, sx, sy, sl, sh, l, h) {
    const cv = document.createElement("canvas");
    cv.width = l; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.drawImage(image, sx, sy, sl, sh, 0, 0, l, h);
    const p = ctx.getImageData(0, 0, l, h).data, n = l * h, t = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      t[i] = p[4 * i + 2] / 127.5 - 1;
      t[n + i] = p[4 * i + 1] / 127.5 - 1;
      t[2 * n + i] = p[4 * i] / 127.5 - 1;
    }
    return new ort.Tensor("float32", t, [1, 3, h, l]);
  },

  // Zones de texte de la photo : rectangles { x, y, l, h } en pixels de l'image
  async _zones(image) {
    const W = image.width, H = image.height;
    const k = Math.min(1, 1280 / Math.max(W, H));
    const l = Math.max(32, Math.round(W * k / 32) * 32), h = Math.max(32, Math.round(H * k / 32) * 32);
    const sortie = await this.det.run({ [this.det.inputNames[0]]: this._tenseur(image, 0, 0, W, H, l, h) });
    const carte = sortie[this.det.outputNames[0]].data; // probabilité « texte » de chaque pixel
    const texte = new Uint8Array(l * h);
    for (let i = 0; i < l * h; i++) texte[i] = carte[i] > 0.3 ? 1 : 0; // pixels de texte
    // zones = groupes de pixels de texte qui se touchent
    const vu = new Uint8Array(l * h), zones = [], pile = [];
    const ajouter = (x1, y1, x2, y2) => {
      let n = 0, somme = 0;
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (texte[y * l + x]) { n++; somme += carte[y * l + x]; }
      const zl = x2 - x1 + 1, zh = y2 - y1 + 1;
      if (Math.min(zl, zh) < 3 || !n || somme / n < 0.5) return; // trop petit ou peu sûr
      // la carte « rétrécit » le texte : on agrandit la zone (d = aire × 1,6 / périmètre)
      const d = zl * zh * 1.6 / (2 * (zl + zh));
      const [ax1, ay1] = [Math.max(0, x1 - d), Math.max(0, y1 - d)];
      const [ax2, ay2] = [Math.min(l, x2 + 1 + d), Math.min(h, y2 + 1 + d)];
      zones.push({ x: ax1 * W / l, y: ay1 * H / h, l: (ax2 - ax1) * W / l, h: (ay2 - ay1) * H / h });
    };
    for (let debut = 0; debut < l * h; debut++) {
      if (!texte[debut] || vu[debut]) continue;
      let x1 = l, y1 = h, x2 = 0, y2 = 0;
      pile.push(debut); vu[debut] = 1;
      while (pile.length) {
        const i = pile.pop(), x = i % l, y = (i - x) / l;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
        for (const j of [x > 0 ? i - 1 : -1, x < l - 1 ? i + 1 : -1, y > 0 ? i - l : -1, y < h - 1 ? i + l : -1])
          if (j >= 0 && texte[j] && !vu[j]) { vu[j] = 1; pile.push(j); }
      }
      // deux lignes de texte collées (ex. « CHROME GOLDEN » / « ANTAGONIST ») : on coupe la zone là
      // où la carte retombe entre les lignes (profil dans le sens de l'épaisseur des lignes)
      const verticale = y2 - y1 > x2 - x1;
      const [a1, a2, b1, b2] = verticale ? [x1, x2, y1, y2] : [y1, y2, x1, x2];
      const profil = [];
      for (let a = a1; a <= a2; a++) {
        let s = 0;
        for (let b = b1; b <= b2; b++) s += carte[verticale ? b * l + a : a * l + b];
        profil.push(s);
      }
      const max = Math.max(...profil);
      let debutLigne = null;
      for (let k = 0; k <= profil.length; k++) {
        const plein = k < profil.length && profil[k] > 0.25 * max;
        if (plein && debutLigne === null) debutLigne = k;
        if (!plein && debutLigne !== null) {
          const [c1, c2] = [a1 + debutLigne, a1 + k - 1];
          if (verticale) ajouter(c1, y1, c2, y2); else ajouter(x1, c1, x2, c2);
          debutLigne = null;
        }
      }
    }
    return zones;
  },

  // Texte d'un morceau d'image (déjà dans le bon sens) : { texte, score }
  async _lireZone(image, x, y, zl, zh) {
    const H = 48, L = Math.max(16, Math.min(1600, Math.ceil(H * zl / zh)));
    const sortie = await this.rec.run({ [this.rec.inputNames[0]]: this._tenseur(image, x, y, zl, zh, L, H) });
    const t = sortie[this.rec.outputNames[0]], [, T, C] = t.dims, p = t.data;
    let texte = "", somme = 0, n = 0, avant = 0;
    for (let i = 0; i < T; i++) {
      let m = 0;
      for (let c = 1; c < C; c++) if (p[i * C + c] > p[i * C + m]) m = c;
      if (m && m !== avant) { texte += this.cles[m] || ""; somme += p[i * C + m]; n++; }
      avant = m;
    }
    return { texte: texte.trim(), score: n ? somme / n : 0 };
  },

  // Rotation (0, 90 ou -90 degrés) qui remet d'aplomb la plupart du texte lu : sert à afficher
  // la photo d'un blister tenu de travers dans le bon sens
  sensDominant(lignes) {
    const poids = { 0: 0, 90: 0, "-90": 0 };
    for (const l of lignes) poids[l.sens] += l.texte.replace(/[^A-Za-z]/g, "").length;
    return [90, -90].find(s => poids[s] > poids[0] && poids[s] > poids[-s]) || 0;
  },

  // Lignes de texte lues sur la photo, de haut en bas : [{ texte, score, sens, x, y, l, h }]
  // une lecture à la fois (le verso peut encore se lire quand le blister suivant est photographié)
  lignes(image) {
    const lecture = (this._file || Promise.resolve()).then(() => this._lignes(image));
    this._file = lecture.catch(() => {});
    return lecture;
  },

  async _lignes(image) {
    await this.charger();
    const res = [];
    for (const z of await this._zones(image)) {
      // pause entre deux lignes : les appuis de l'utilisateur passent pendant une longue lecture (verso lu pendant
      // qu'on remplit la fiche ; sans elle, « Ajouter » restait bloqué ⏳ jusqu'à la fin de la lecture)
      await new Promise(ok => setTimeout(ok, 0));
      let lu;
      if (z.h > 1.5 * z.l) {
        // texte vertical : on essaie les deux sens de rotation, on garde la lecture la plus sûre
        const cv = document.createElement("canvas");
        cv.width = Math.round(z.l); cv.height = Math.round(z.h);
        cv.getContext("2d").drawImage(image, z.x, z.y, z.l, z.h, 0, 0, cv.width, cv.height);
        const essais = [];
        for (const sens of [90, -90]) {
          const r = tourner(cv, sens);
          essais.push({ ...(await this._lireZone(r, 0, 0, r.width, r.height)), sens });
        }
        lu = essais.sort((a, b) => b.score - a.score)[0];
      } else lu = { ...(await this._lireZone(image, z.x, z.y, z.l, z.h)), sens: 0 };
      if (lu.texte && lu.score >= 0.5) res.push({ ...lu, ...z });
    }
    return res.sort((a, b) => a.y - b.y || a.x - b.x);
  },
};
