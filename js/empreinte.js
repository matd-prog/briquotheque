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
