// « Empreinte » d'une photo de blister : couleurs du décor et leur disposition, pour retrouver
// un blister parmi ceux du catalogue JB. Même calcul pour les photos du catalogue (outils/empreintes_jb.js)
// et pour les photos prises avec le téléphone.

const EMPREINTE_GRILLE = 6, EMPREINTE_TAILLE = 60;

// source : image, canvas ou ImageBitmap ; catalogue = true pour une photo du site JB
// (on n'y garde que le carton, en retirant le haut du blister et le bas de la figurine)
function empreinteImage(source, catalogue) {
  const w = source.width, h = source.height;
  const [x, y, l, ht] = catalogue ? [w * 0.08, h * 0.12, w * 0.84, h * 0.68] : [0, 0, w, h];
  const cv = document.createElement("canvas");
  cv.width = cv.height = EMPREINTE_TAILLE;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, l, ht, 0, 0, EMPREINTE_TAILLE, EMPREINTE_TAILLE);
  const p = ctx.getImageData(0, 0, EMPREINTE_TAILLE, EMPREINTE_TAILLE).data;

  const n = EMPREINTE_GRILLE, bloc = EMPREINTE_TAILLE / n;
  const grille = new Float64Array(n * n * 3), hist = new Float64Array(108);
  for (let py = 0; py < EMPREINTE_TAILLE; py++) {
    for (let px = 0; px < EMPREINTE_TAILLE; px++) {
      const i = (py * EMPREINTE_TAILLE + px) * 4;
      const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let t = 0;
      if (d) t = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const teinte = t / 6, sat = max ? d / max : 0, val = max;
      const c = (Math.floor(py / bloc) * n + Math.floor(px / bloc)) * 3;
      grille[c] += Math.cos(teinte * 2 * Math.PI) * sat;
      grille[c + 1] += Math.sin(teinte * 2 * Math.PI) * sat;
      grille[c + 2] += val;
      hist[Math.min(11, Math.floor(teinte * 12)) * 9 + Math.min(2, Math.floor(sat * 3)) * 3 + Math.min(2, Math.floor(val * 3))]++;
    }
  }
  const norme = v => { const s = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1; return v.map(x => x / s); };
  const g = norme(grille), hs = norme(hist.map(Math.sqrt));
  return Float32Array.from([...g, ...hs].map(x => x * Math.SQRT1_2));
}

// Empreinte -> texte compact (un octet par valeur, en base64) et inversement
function empreinteEnTexte(v) {
  return btoa(String.fromCharCode(...v.map(x => Math.max(-127, Math.min(127, Math.round(x * 170))) & 255)));
}
function empreinteDepuisTexte(t) {
  return Float32Array.from(atob(t), c => { const o = c.charCodeAt(0); return (o > 127 ? o - 256 : o) / 170; });
}

function similarite(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// « Empreinte » d'une figurine (photo prise, ou photo officielle sur fond blanc) : le fond (couleur des bords)
// est retiré, la figurine est recadrée au plus près, puis on garde ses couleurs de haut en bas (tête, buste,
// jambes) et leur répartition. Sert à retrouver une nouveauté que Brickognize ne connaît pas encore.
const EMPREINTE_FIG_L = 3, EMPREINTE_FIG_H = 6, EMPREINTE_FIG_TAILLE = 72;

function empreinteFigurine(source) {
  const T = EMPREINTE_FIG_TAILLE, w = source.width, h = source.height, k = T / Math.max(w, h);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, cv.width, cv.height);
  const W = cv.width, H = cv.height, p = ctx.getImageData(0, 0, W, H).data;

  // fond : médiane des pixels du bord
  const bord = [];
  for (let x = 0; x < W; x++) bord.push(x, x + (H - 1) * W);
  for (let y = 1; y < H - 1; y++) bord.push(y * W, y * W + W - 1);
  const med = c => { const v = bord.map(i => p[i * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const fond = [med(0), med(1), med(2)];
  const garde = new Uint8Array(W * H);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const d = Math.abs(p[i] - fond[0]) + Math.abs(p[i + 1] - fond[1]) + Math.abs(p[i + 2] - fond[2]);
    if (d > 70) { garde[y * W + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; garde.fill(1); }

  const nl = EMPREINTE_FIG_L, nh = EMPREINTE_FIG_H;
  const grille = new Float64Array(nl * nh * 3), poids = new Float64Array(nl * nh), hist = new Float64Array(108);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!garde[y * W + x]) continue;
    const i = (y * W + x) * 4;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let t = 0;
    if (d) t = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const teinte = t / 6, sat = max ? d / max : 0, val = max;
    const cx = Math.min(nl - 1, Math.floor((x - x0) / (x1 - x0 + 1) * nl)), cy = Math.min(nh - 1, Math.floor((y - y0) / (y1 - y0 + 1) * nh));
    const c = cy * nl + cx;
    grille[c * 3] += Math.cos(teinte * 2 * Math.PI) * sat;
    grille[c * 3 + 1] += Math.sin(teinte * 2 * Math.PI) * sat;
    grille[c * 3 + 2] += val;
    poids[c]++;
    hist[Math.min(11, Math.floor(teinte * 12)) * 9 + Math.min(2, Math.floor(sat * 3)) * 3 + Math.min(2, Math.floor(val * 3))]++;
  }
  for (let c = 0; c < nl * nh; c++) if (poids[c]) for (let j = 0; j < 3; j++) grille[c * 3 + j] /= poids[c];
  const norme = v => { const s = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1; return v.map(x => x / s); };
  const g = norme(grille), hs = norme(hist.map(Math.sqrt));
  return Float32Array.from([...g, ...hs].map(x => x * Math.SQRT1_2));
}

// Figurine seule au centre d'un blister (photo recadrée sur le blister) : sert à départager des blisters au même
// carton dont seule la figurine change (ex. les « SPECIAL WHATNOT FIGURE 2025 »), le décor entier étant presque identique
function empreinteCentreBlister(source) {
  const w = source.width, h = source.height, c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * 0.36)); c.height = Math.max(1, Math.round(h * 0.62));
  c.getContext("2d").drawImage(source, w * 0.32, h * 0.22, c.width, c.height, 0, 0, c.width, c.height);
  return empreinteFigurine(c);
}
