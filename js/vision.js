// Reconnaissance d'image (comme les scanners de cartes à collectionner) : le modèle DINOv2 (petite version,
// lib/vision/, 24 Mo téléchargés une fois puis gardés par le téléphone) résume la photo du blister en 768 nombres ;
// deux photos du même blister donnent des résumés très proches, même avec un autre éclairage ou un autre angle.
// Résumés de référence : data/jb_vision.tsv (photos du catalogue JB et de l'album, outils/vision_jb.js) et
// data/jb_vision_commune.tsv (photos de la base commune). Rien n'est envoyé sur Internet.
// Mesure du 07/10/2026 : figurine déjà photographiée 39/39 reconnue par l'image seule ; blister jamais vu 129/243
// (photo du catalogue comme seule référence), en partie d'autres que ceux reconnus par la lecture du nom.

const Vision = {
  _pret: null,
  _refs: null,
  TAILLE: 280, // côté de l'image donnée au modèle (multiple de 14 ; 280 : 139 jamais vus reconnus sur 243, contre 129 en 224)

  charger() {
    if (!this._pret) {
      this._pret = (async () => {
        if (typeof ort === "undefined") await new Promise((ok, ko) => {
          const s = document.createElement("script");
          s.src = "lib/paddle/ort.wasm.min.js";
          s.onload = ok; s.onerror = () => ko(new Error("moteur de vision absent"));
          document.head.appendChild(s);
        });
        ort.env.wasm.numThreads = 1; // plusieurs fils demandent des en-têtes que GitHub Pages n'envoie pas
        ort.env.wasm.wasmPaths = new URL("lib/paddle/", location.href).href;
        this.session = await ort.InferenceSession.create("lib/vision/dinov2_small_q8.onnx");
      })().catch(err => { this._pret = null; throw err; });
    }
    return this._pret;
  },

  // Image -> tenseur [1, 3, n, n] : petit côté ramené à n·256/224, carré central de n × n, couleurs normalisées
  // comme à l'entraînement du modèle (moyenne et écart des photos ImageNet)
  _tenseur(image) {
    const n = this.TAILLE, W = image.width, H = image.height;
    const k = n * 256 / 224 / Math.min(W, H);
    const cote = n / k; // côté du carré central, en pixels de l'image
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, (W - cote) / 2, (H - cote) / 2, cote, cote, 0, 0, n, n);
    const p = ctx.getImageData(0, 0, n, n).data, m = n * n, t = new Float32Array(3 * m);
    const moy = [0.485, 0.456, 0.406], ec = [0.229, 0.224, 0.225];
    for (let i = 0; i < m; i++) for (let c = 0; c < 3; c++) t[c * m + i] = (p[4 * i + c] / 255 - moy[c]) / ec[c];
    return new ort.Tensor("float32", t, [1, 3, n, n]);
  },

  // Résumé de la photo : jeton de synthèse du modèle suivi de la moyenne des morceaux d'image, longueur 1
  async vecteur(image) {
    await this.charger();
    const sortie = await this.session.run({ pixel_values: this._tenseur(image) });
    const h = sortie.last_hidden_state, [, n, d] = h.dims, x = h.data;
    const v = new Float32Array(2 * d);
    for (let j = 0; j < d; j++) v[j] = x[j];
    for (let i = 1; i < n; i++) for (let j = 0; j < d; j++) v[d + j] += x[i * d + j] / (n - 1);
    let norme = 0;
    for (const a of v) norme += a * a;
    norme = Math.sqrt(norme) || 1;
    for (let j = 0; j < v.length; j++) v[j] /= norme;
    return v;
  },

  // Résumé <-> texte (base64 d'entiers de -127 à 127) pour data/jb_vision.tsv
  enTexte(v) {
    const o = new Int8Array(v.length);
    let max = 0;
    for (const a of v) max = Math.max(max, Math.abs(a));
    for (let i = 0; i < v.length; i++) o[i] = Math.round(v[i] / (max || 1) * 127); // longueur rétablie à la lecture
    return btoa(String.fromCharCode(...new Uint8Array(o.buffer)));
  },
  depuisTexte(t) {
    const b = atob(t), o = new Int8Array(b.length);
    for (let i = 0; i < b.length; i++) o[i] = (b.charCodeAt(i) << 24) >> 24;
    const v = new Float32Array(o.length);
    let norme = 0;
    for (let i = 0; i < o.length; i++) { v[i] = o[i]; norme += o[i] * o[i]; }
    norme = Math.sqrt(norme) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norme;
    return v;
  },

  chargerReferences() {
    if (!this._refs) {
      const lire = f => fetch(f).then(r => r.ok ? r.text() : "").catch(() => "");
      // catalogue et album (outils/vision_jb.js) ; base commune (ajoutés à chaque envoi, js/base_commune.js)
      this._refs = Promise.all([lire("data/jb_vision.tsv"), lire("data/jb_vision_commune.tsv")]).then(t => t.join("\n")).then(texte => {
        const refs = new Map();
        for (const ligne of texte.split("\n")) {
          const [code, e] = ligne.split("\t");
          if (!code || code === "code" || !e) continue;
          const k = code.toUpperCase();
          if (!refs.has(k)) refs.set(k, []);
          refs.get(k).push(this.depuisTexte(e));
        }
        return refs;
      }).catch(() => { this._refs = null; return new Map(); });
    }
    return this._refs;
  },

  // Ressemblance de la photo avec chaque figurine du catalogue qui a une référence : Map(fiche -> 0 à 1)
  async classer(image, sauf = null) {
    const [refs, v] = await Promise.all([this.chargerReferences(), this.vecteur(image)]);
    const res = new Map();
    if (!CatalogueJB.liste) return res;
    for (const f of CatalogueJB.liste) {
      let meilleur = -1;
      for (const c of CatalogueJB.codes(f)) {
        if (sauf && sauf.has(c)) continue;
        for (const r of refs.get(c) || []) {
          let s = 0;
          for (let i = 0; i < v.length; i++) s += v[i] * r[i];
          if (s > meilleur) meilleur = s;
        }
      }
      if (meilleur > -1) res.set(f, meilleur);
    }
    return res;
  },
};
