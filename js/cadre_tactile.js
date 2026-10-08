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
};
