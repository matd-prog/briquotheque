// Dessin des étiquettes : fond couleur du camp, QR code vers BrickLink dans un
// cadre blanc arrondi à gauche, code de la figurine en gras à droite.

const CAMPS = {
  "Gentil":     { onglet: "Gentils (vert)",   couleur: "#00B050" },
  "Méchant":    { onglet: "Méchants (rouge)", couleur: "#FF0000" },
  "Zone grise": { onglet: "Zone grise",       couleur: "#A0A5A9" },
};

const ECHELLE = 6; // rendu 6 fois plus grand que la taille affichée, pour l'impression

// Type d'objet BrickLink selon la forme du code :
//  SW0631 -> figurine (M), 853449 -> objet/porte-clés (G), 5002938-1 -> set (S)
function typeBricklink(code) {
  if (/^\d+-\d+$/.test(code)) return "S";
  if (/^\d+$/.test(code)) return "G";
  return "M";
}

function urlBricklink(code) {
  return "https://www.bricklink.com/v2/catalog/catalogitem.page?" +
    typeBricklink(code) + "=" + encodeURIComponent(code.toLowerCase());
}

// Code non utilisable pour une étiquette : vide, CUSTOM (figurine personnalisée),
// ou plusieurs codes dans la même case (ex. « SW1348 - SW1394 »)
function codeInvalide(code) {
  const c = (code || "").trim();
  return !c || /^custom$/i.test(c) || !/^[A-Za-z0-9]+(-\d+)?$/.test(c);
}

// Coupe le code en deux lignes quand c'est possible ("SW" / "1357") pour écrire plus gros
function lignesDuCode(code) {
  const m = /^([A-Za-z]+)(\d.*)$/.exec(code);
  if (m) return [m[1], m[2]];
  const t = /^(.+)(-\d+)$/.exec(code);            // 5002938-1 -> 5002938 / -1
  if (t) return [t[1], t[2]];
  if (code.length >= 6) {                          // 850353 -> 850 / 353
    const mil = Math.ceil(code.length / 2);
    return [code.slice(0, mil), code.slice(mil)];
  }
  return [code];
}

function coinsArrondis(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// w, h : taille affichée en pixels Excel. Renvoie un canvas de (w*6) x (h*6).
function dessinerEtiquette(code, couleur, w, h) {
  const S = ECHELLE, W = w * S, H = h * S;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, W, H);

  // QR code : carré blanc arrondi sur toute la hauteur, à gauche
  const pad = Math.round(1.5 * S);
  const cote = H - 2 * pad;
  ctx.fillStyle = "#fff";
  coinsArrondis(ctx, pad, pad, cote, cote, 2 * S);
  ctx.fill();

  const qr = qrcode(0, "L");
  qr.addData(urlBricklink(code));
  qr.make();
  const n = qr.getModuleCount();
  const marge = 2; // zone de silence (en modules) à l'intérieur du cadre blanc
  const module = Math.floor(cote / (n + 2 * marge)); // entier : pas de flou sur les modules
  const taille = module * n;
  const qx = pad + Math.floor((cote - taille) / 2);
  const qy = pad + Math.floor((cote - taille) / 2);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect(qx + c * module, qy + r * module, module, module);

  // Code en gras noir, à droite, le plus grand possible
  const x0 = pad + cote + Math.round(1.5 * S);
  const zoneW = W - x0 - pad, zoneH = H - 2 * pad;
  const lignes = lignesDuCode(code);
  const police = t => `bold ${t}px Roboto, Arial, Helvetica, sans-serif`;
  let t = Math.floor(zoneH / lignes.length * 0.95);
  ctx.font = police(t);
  while (t > 10 && Math.max(...lignes.map(l => ctx.measureText(l).width)) > zoneW) {
    t -= 2; ctx.font = police(t);
  }
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = x0 + zoneW / 2, hLigne = zoneH / lignes.length;
  lignes.forEach((l, i) => ctx.fillText(l, cx, pad + hLigne * (i + 0.5)));
  return cv;
}

function canvasEnPng(cv) {
  return new Promise(ok => cv.toBlob(b => b.arrayBuffer().then(buf => ok(new Uint8Array(buf))), "image/png"));
}
