// Gestes du cadre de recadrage (blisters et figurines), revus le 08/10/2026 à la demande de Mathias :
//  - un doigt près d'un coin (jusqu'à 60 px) attrape ce coin, même s'il tombe un peu à côté du rond : seul ce coin
//    bouge, le coin opposé et les autres bords restent en place ;
//  - près d'un bord (jusqu'à 40 px) : seul ce bord bouge ;
//  - au milieu du cadre : le cadre entier se déplace ;
//  - pendant qu'on tire un coin ou un bord, une loupe au-dessus du doigt montre l'endroit agrandi (le doigt cache
//    sinon le bord du blister).
// cadre : { x, y, l, h } en fractions de l'image affichée.
const CadreTactile = {
  installer(zone, lire, ecrire, MIN = 0.1) {
    if (!zone) return;
    const img = zone.querySelector("img");
    const loupe = document.createElement("canvas");
    loupe.className = "loupe-recadrage";
    loupe.width = loupe.height = 240;
    loupe.hidden = true;
    document.body.appendChild(loupe);
    const borner = (v, a, b) => Math.min(b, Math.max(a, v));
    let geste = null;

    // quelle partie du cadre le doigt attrape : coin, bord, cadre entier, ou rien
    const choisir = (px, py, r) => {
      const c = lire(), X = [c.x * r.width, (c.x + c.l) * r.width], Y = [c.y * r.height, (c.y + c.h) * r.height];
      let coin = null, mieux = 60;
      for (const [nom, cx, cy] of [["hg", X[0], Y[0]], ["hd", X[1], Y[0]], ["bg", X[0], Y[1]], ["bd", X[1], Y[1]]]) {
        const d = Math.hypot(px - cx, py - cy);
        if (d < mieux) { mieux = d; coin = nom; }
      }
      if (coin) return coin;
      const dedansX = px > X[0] && px < X[1], dedansY = py > Y[0] && py < Y[1];
      const bords = [["g", Math.abs(px - X[0]), dedansY], ["d", Math.abs(px - X[1]), dedansY],
                     ["h", Math.abs(py - Y[0]), dedansX], ["b", Math.abs(py - Y[1]), dedansX]].filter(b => b[2] && b[1] < 40);
      if (bords.length) return bords.sort((a, b) => a[1] - b[1])[0][0];
      return dedansX && dedansY ? "tout" : null;
    };

    // loupe : l'image agrandie 2,5 fois autour du point tiré, avec le cadre et une croix
    const montrerLoupe = (e, r, c) => {
      if (!img || !img.naturalWidth || geste.partie === "tout") { loupe.hidden = true; return; }
      const p = geste.partie;
      const fx = p.includes("g") ? c.x : p.includes("d") ? c.x + c.l : (e.clientX - r.left) / r.width;
      const fy = p.includes("h") ? c.y : p.includes("b") ? c.y + c.h : (e.clientY - r.top) / r.height;
      const k = 2.5, t = 120, cote = loupe.width; // agrandissement ; taille de la loupe à l'écran ; en pixels du dessin
      const vue = t / k * (img.naturalWidth / r.width); // largeur vue, en pixels de l'image d'origine
      const ctx = loupe.getContext("2d");
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cote, cote);
      ctx.drawImage(img, fx * img.naturalWidth - vue / 2, fy * img.naturalHeight - vue / 2, vue, vue, 0, 0, cote, cote);
      // bords du cadre dans la loupe
      const ech = cote / (t / k); // pixels du dessin par pixel affiché
      const ox = cote / 2 - fx * r.width * ech, oy = cote / 2 - fy * r.height * ech;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      ctx.strokeRect(ox + c.x * r.width * ech, oy + c.y * r.height * ech, c.l * r.width * ech, c.h * r.height * ech);
      ctx.strokeStyle = "#d9476b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cote / 2 - 14, cote / 2); ctx.lineTo(cote / 2 + 14, cote / 2);
      ctx.moveTo(cote / 2, cote / 2 - 14); ctx.lineTo(cote / 2, cote / 2 + 14); ctx.stroke();
      // au-dessus du doigt (en dessous s'il n'y a pas la place), dans l'écran
      const gauche = borner(e.clientX - t / 2, 4, innerWidth - t - 4);
      const haut = e.clientY - t - 70 > 4 ? e.clientY - t - 70 : Math.min(innerHeight - t - 4, e.clientY + 70);
      Object.assign(loupe.style, { left: gauche + "px", top: haut + "px" });
      loupe.hidden = false;
    };

    zone.addEventListener("pointerdown", e => {
      const r = zone.getBoundingClientRect();
      const partie = choisir(e.clientX - r.left, e.clientY - r.top, r);
      if (!partie) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      geste = { partie, x0: e.clientX, y0: e.clientY, r, depart: { ...lire() } };
      montrerLoupe(e, r, geste.depart);
    });
    zone.addEventListener("pointermove", e => {
      if (!geste) return;
      const dx = (e.clientX - geste.x0) / geste.r.width, dy = (e.clientY - geste.y0) / geste.r.height, d = geste.depart, p = geste.partie;
      let { x, y, l, h } = d;
      if (p === "tout") { x = borner(d.x + dx, 0, 1 - d.l); y = borner(d.y + dy, 0, 1 - d.h); }
      else {
        if (p.includes("g")) { x = borner(d.x + dx, 0, d.x + d.l - MIN); l = d.x + d.l - x; }
        if (p.includes("d")) l = borner(d.l + dx, MIN, 1 - d.x);
        if (p.includes("h")) { y = borner(d.y + dy, 0, d.y + d.h - MIN); h = d.y + d.h - y; }
        if (p.includes("b")) h = borner(d.h + dy, MIN, 1 - d.y);
      }
      ecrire({ x, y, l, h });
      montrerLoupe(e, geste.r, { x, y, l, h });
    });
    for (const f of ["pointerup", "pointercancel"]) zone.addEventListener(f, () => { geste = null; loupe.hidden = true; });
  },

  // ——— Cadre à 4 coins libres (blisters, 08/10/2026, Mathias : « quand on bouge un coin, les autres ne doivent pas
  // bouger ») : chaque coin se place seul, comme dans les scanners de documents ; la photo est ensuite redressée en
  // rectangle (Base._reduire). cadre : { x, y, l, h, coins: [[x, y] haut gauche, haut droit, bas droit, bas gauche] }.
  coins(c) {
    if (c.coins && c.coins.length === 4) return c.coins.map(p => [...p]);
    return [[c.x, c.y], [c.x + c.l, c.y], [c.x + c.l, c.y + c.h], [c.x, c.y + c.h]];
  },
  depuisCoins(coins) {
    const xs = coins.map(p => p[0]), ys = coins.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, l: Math.max(...xs) - x, h: Math.max(...ys) - y, coins: coins.map(p => [...p]) };
  },
  // quadrilatère sans croisement, ni angle rentrant ou trop plat (sinon le redressement de la photo n'a pas de sens)
  convexe(q) {
    let signe = 0;
    for (let i = 0; i < 4; i++) {
      const [a, b, c] = [q[i], q[(i + 1) % 4], q[(i + 2) % 4]];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      const z = u[0] * v[1] - u[1] * v[0], lu = Math.hypot(...u), lv = Math.hypot(...v);
      if (lu < 0.05 || lv < 0.05 || Math.abs(z) < 0.35 * lu * lv) return false; // côté trop court, angle < 20° ou > 160°
      if (signe && Math.sign(z) !== signe) return false;
      signe = Math.sign(z);
    }
    return true;
  },

  installerQuad(zone, lire, ecrire) {
    if (!zone) return;
    const img = zone.querySelector("img");
    const loupe = document.createElement("canvas");
    loupe.className = "loupe-recadrage";
    loupe.width = loupe.height = 240;
    loupe.hidden = true;
    document.body.appendChild(loupe);
    const borner = v => Math.min(1, Math.max(0, v));
    let geste = null;
    const enPx = (q, r) => q.map(p => [p[0] * r.width, p[1] * r.height]);
    const dedans = (pt, q) => { // point dans le quadrilatère (lancer de rayon)
      let ok = false;
      for (let i = 0, j = 3; i < 4; j = i++) {
        const [xi, yi] = q[i], [xj, yj] = q[j];
        if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ok = !ok;
      }
      return ok;
    };
    const distSegment = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    // ce que le doigt attrape : un coin (seul lui bouge), un bord (ses deux coins), ou tout le cadre
    const choisir = (pt, r) => {
      const q = enPx(this.coins(lire()), r);
      let mieux = 60, coin = -1;
      q.forEach((p, i) => { const d = Math.hypot(pt[0] - p[0], pt[1] - p[1]); if (d < mieux) { mieux = d; coin = i; } });
      if (coin >= 0) return { coins: [coin] };
      let bord = -1; mieux = 40;
      for (let i = 0; i < 4; i++) { const d = distSegment(pt, q[i], q[(i + 1) % 4]); if (d < mieux) { mieux = d; bord = i; } }
      if (bord >= 0) return { coins: [bord, (bord + 1) % 4] };
      return dedans(pt, q) ? { coins: [0, 1, 2, 3], tout: true } : null;
    };
    const montrerLoupe = (e, r, q, point) => {
      if (!img || !img.naturalWidth || geste.tout) { loupe.hidden = true; return; }
      const k = 2.5, t = 120, cote = loupe.width, ech = cote / (t / k);
      const vue = t / k * (img.naturalWidth / r.width);
      const [fx, fy] = point;
      const ctx = loupe.getContext("2d");
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, cote, cote);
      ctx.drawImage(img, fx * img.naturalWidth - vue / 2, fy * img.naturalHeight - vue / 2, vue, vue, 0, 0, cote, cote);
      const vers = p => [cote / 2 + (p[0] - fx) * r.width * ech, cote / 2 + (p[1] - fy) * r.height * ech];
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath();
      q.forEach((p, i) => { const [a, b] = vers(p); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = "#d9476b"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(cote / 2 - 14, cote / 2); ctx.lineTo(cote / 2 + 14, cote / 2);
      ctx.moveTo(cote / 2, cote / 2 - 14); ctx.lineTo(cote / 2, cote / 2 + 14); ctx.stroke();
      const gauche = Math.min(innerWidth - t - 4, Math.max(4, e.clientX - t / 2));
      const haut = e.clientY - t - 70 > 4 ? e.clientY - t - 70 : Math.min(innerHeight - t - 4, e.clientY + 70);
      Object.assign(loupe.style, { left: gauche + "px", top: haut + "px" });
      loupe.hidden = false;
    };
    zone.addEventListener("pointerdown", e => {
      const r = zone.getBoundingClientRect();
      const choix = choisir([e.clientX - r.left, e.clientY - r.top], r);
      if (!choix) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      geste = { ...choix, x0: e.clientX, y0: e.clientY, r, depart: this.coins(lire()) };
      const d = geste.depart, p = geste.coins.length === 1 ? d[geste.coins[0]] : [(d[geste.coins[0]][0] + d[geste.coins[1]][0]) / 2, (d[geste.coins[0]][1] + d[geste.coins[1]][1]) / 2];
      montrerLoupe(e, r, d, p);
    });
    zone.addEventListener("pointermove", e => {
      if (!geste) return;
      let dx = (e.clientX - geste.x0) / geste.r.width, dy = (e.clientY - geste.y0) / geste.r.height;
      const d = geste.depart;
      if (geste.tout) { // tout le cadre, sans sortir de la photo
        dx = Math.min(1 - Math.max(...d.map(p => p[0])), Math.max(-Math.min(...d.map(p => p[0])), dx));
        dy = Math.min(1 - Math.max(...d.map(p => p[1])), Math.max(-Math.min(...d.map(p => p[1])), dy));
      }
      const q = d.map((p, i) => geste.coins.includes(i) ? [borner(p[0] + dx), borner(p[1] + dy)] : [...p]);
      if (!this.convexe(q)) return; // coin passé de l'autre côté : refusé
      ecrire(this.depuisCoins(q));
      const p = geste.coins.length === 1 ? q[geste.coins[0]] : [(q[geste.coins[0]][0] + q[geste.coins[1]][0]) / 2, (q[geste.coins[0]][1] + q[geste.coins[1]][1]) / 2];
      montrerLoupe(e, geste.r, q, p);
    });
    for (const f of ["pointerup", "pointercancel"]) zone.addEventListener(f, () => { geste = null; loupe.hidden = true; });
  },
};
