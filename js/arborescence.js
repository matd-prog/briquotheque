// Arborescence des menus, sur le côté gauche, pour les grands écrans (ordinateur, tablette en largeur).
// Elle est construite à partir de l'accueil (titres de rubriques, gros boutons et tuiles, puis les Outils) : un menu
// ajouté à l'accueil y apparaît tout seul. Un clic dans l'arborescence « touche » le bouton correspondant de l'accueil,
// donc fait exactement la même chose. Sur téléphone (écran étroit), elle reste cachée.

const Arborescence = {
  construire() {
    const nav = document.getElementById("arborescence");
    const accueil = document.getElementById("ecran-accueil");
    if (!nav || !accueil) return;
    const cibles = [];
    const lien = (el, texte, cle) => {
      cibles.push(el);
      return `<button class="arbo-lien" data-arbo="${cibles.length - 1}"${cle ? ` data-arbo-ecran="${cle}"` : ""}>${texte}</button>`;
    };
    const texteDe = el => {
      const icone = el.querySelector(".icone");
      const titre = el.querySelector("b");
      return titre ? `${icone ? icone.textContent.trim() + " " : ""}${echapper(titre.textContent.trim())}`
        : echapper(el.textContent.trim().replace(/\s+/g, " "));
    };

    let html = `<button class="arbo-lien arbo-accueil" data-arbo-accueil>🏠 Accueil</button>`;
    let groupe = null;
    for (const el of accueil.querySelectorAll(".section-titre, .action-principale, .tuile")) {
      if (el.classList.contains("section-titre")) {
        if (groupe !== null) html += `</div></details>`;
        groupe = el.textContent.trim();
        html += `<details class="arbo-groupe" open><summary>${echapper(groupe)}</summary><div>`;
      } else html += lien(el, texteDe(el), el.dataset.action || "");
    }
    if (groupe !== null) html += `</div></details>`;

    // Outils : les boutons principaux du bloc Outils de l'accueil
    const outils = document.getElementById("outils");
    if (outils) {
      html += `<details class="arbo-groupe"><summary>🛠️ Outils</summary><div>` +
        `<button class="arbo-lien" data-arbo-outils>Ouvrir les Outils</button>`;
      for (const b of outils.querySelectorAll(":scope > button[data-action], :scope > div > button[data-action]"))
        html += lien(b, echapper(b.textContent.trim().replace(/\s+/g, " ")));
      html += `</div></details>`;
    }
    nav.innerHTML = html;
    this.cibles = cibles;
  },

  // Montrée dès qu'une collection est ouverte ; le menu de l'écran affiché est mis en évidence
  suivre(ecran) {
    const nav = document.getElementById("arborescence");
    if (!nav) return;
    const visible = typeof etat !== "undefined" && !!etat.classeur && ecran !== "fichier";
    nav.hidden = !visible;
    document.body.classList.toggle("avec-arborescence", visible);
    nav.querySelectorAll(".arbo-lien").forEach(b => b.classList.toggle("actif",
      b.hasAttribute("data-arbo-accueil") ? ecran === "accueil" : b.dataset.arboEcran === ecran));
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("#arborescence .arbo-lien");
  if (!b) return;
  if (b.hasAttribute("data-arbo-accueil")) { if (ecranActuel !== "accueil") afficher("accueil"); return; }
  if (b.hasAttribute("data-arbo-outils")) {
    if (ecranActuel !== "accueil") afficher("accueil");
    $("outils").open = true;
    $("outils").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const cible = Arborescence.cibles && Arborescence.cibles[+b.dataset.arbo];
  if (!cible) return;
  // une case photo s'ouvre depuis l'accueil (l'écran suivant s'affiche au retour de l'appareil photo)
  if (cible.matches("label") && ecranActuel !== "accueil") afficher("accueil");
  cible.click();
});

Arborescence.construire();
if (typeof ecranActuel !== "undefined" && ecranActuel) Arborescence.suivre(ecranActuel);
