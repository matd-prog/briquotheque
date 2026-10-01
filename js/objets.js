// Objets dérivés LEGO du catalogue BrickLink « Gear » (porte-clés, porte-clés lumineux, magnets…) :
// onglet « Objets dérivés » du fichier Excel, valorisés comme les sets (js/valeur.js, type GEAR).

const EcranObjet = {
  async ouvrir() {
    for (const id of ["objet-nom", "objet-code", "objet-remarques"]) $(id).value = "";
    $("objet-quantite").value = 1;
    $("objet-nouveautes").innerHTML = "";
    afficher("objet");
    this.lister();
  },

  // Objets dérivés récents (nouveautés Rebrickable) dont le nom correspond à ce qui est tapé : un toucher remplit le numéro
  async suggerer() {
    const zone = $("objet-nouveautes"), q = $("objet-nom").value.trim();
    if (q.length < 2 || typeof Nouveautes === "undefined") { zone.innerHTML = ""; return; }
    await Nouveautes.charger();
    const res = Nouveautes.chercherObjets(q);
    zone.innerHTML = res.map((n, i) => `<button class="proposition" data-objet-nouveau="${i}">
        ${n.image ? `<img src="${echapper(n.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo">Pas de photo</div>`}
        <span class="nom-court">${echapper(n.nom)}</span>
        <span class="code">${echapper(n.bricklink)}</span><span class="score">🆕 ${echapper(n.annee)}</span></button>`).join("");
    zone.querySelectorAll("[data-objet-nouveau]").forEach(b => b.addEventListener("click", () => {
      const n = res[+b.dataset.objetNouveau];
      $("objet-nom").value = n.nom;
      $("objet-code").value = n.bricklink;
      if (/light|lampe|torch/i.test(n.nom)) $("objet-type").value = "Porte-clés lumineux";
      else if (/key ?chain|porte/i.test(n.nom)) $("objet-type").value = "Porte-clés";
      else if (/magnet/i.test(n.nom)) $("objet-type").value = "Magnet";
      zone.innerHTML = "";
      toast("Numéro rempli : vérifiez-le sur BrickLink si besoin.");
    }));
  },

  chercher() {
    const q = $("objet-nom").value.trim();
    if (!q) { toast("Écrivez d'abord ce que c'est (en anglais de préférence : key chain, key light, magnet…)."); return; }
    window.open(`https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(q)}#T=G`, "_blank", "noopener");
  },

  async ajouter() {
    const code = $("objet-code").value.trim().replace(/\s+/g, "");
    if (!code) { await demander("Indiquez le numéro BrickLink de l'objet (touchez « Trouver son numéro sur BrickLink »).", "OK", "Fermer"); return; }
    const objet = { code, nom: $("objet-nom").value.trim(), type: $("objet-type").value, etat: $("objet-etat").value,
                    quantite: Math.max(1, +$("objet-quantite").value || 1), remarques: $("objet-remarques").value.trim() };
    try {
      await ajouterObjet(etat.classeur, objet);
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      toast(`${objet.nom || code} ajouté à l'onglet « ${ONGLET_OBJETS} » ✔ (pensez à enregistrer)`);
      this.ouvrir();
    } catch (err) {
      console.error(err);
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },

  async lister() {
    const objets = etat.classeur ? await lireObjets(etat.classeur) : [];
    $("objet-liste").innerHTML = objets.length ? `<div class="carte"><p class="sous-titre">Vos objets dérivés (${objets.length})</p>
      ${objets.map(o => `<div class="ligne-valeur"><span>${echapper(o.nom || o.type || "")} <span class="score">${echapper(o.code)}` +
        `${o.quantite > 1 ? ` ×${o.quantite}` : ""} · ${echapper(o.etat)}</span></span>` +
        `<a href="https://www.bricklink.com/v2/catalog/catalogitem.page?G=${encodeURIComponent(o.code)}" target="_blank" rel="noopener">BrickLink</a></div>`).join("")}</div>` : "";
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "objet") EcranObjet.ouvrir();
  else if (a === "objet-chercher") EcranObjet.chercher();
  else if (a === "objet-ajouter") EcranObjet.ajouter();
});

{
  let minuteur;
  $("objet-nom").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => EcranObjet.suggerer(), 250); });
}
