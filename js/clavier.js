// Clavier des champs de recherche (blisters, figurines, sets…) : on tape au clavier, puis le clavier se retire pour
// laisser voir les résultats (demande de Mathias, 08/10/2026). Il se retire :
//  - à la loupe « Rechercher » du clavier. Selon le téléphone et le clavier, elle n'envoie pas la même chose (Entrée,
//    Entrée « non identifiée » pendant la saisie prédictive, validation de formulaire, événement « search ») : tous
//    sont écoutés, et chaque champ est placé dans un petit formulaire pour que la loupe le valide ;
//  - quand on touche ou fait défiler l'écran en dehors du champ (on regarde les résultats) ;
//  - après une pause de 1,5 s sans taper, les résultats étant déjà affichés au fil de la frappe.
// Toucher le champ fait revenir le clavier. Vaut pour l'appli principale et la mini-appli de l'ami.
(() => {
  const PAUSE = 1500;
  let minuteur = null;
  const estRecherche = el => el && el.tagName === "INPUT" && el.type === "search";
  const retirer = champ => {
    clearTimeout(minuteur);
    const el = champ || document.activeElement;
    if (!estRecherche(el) || document.activeElement !== el) return;
    el.blur();
    setTimeout(() => { if (document.activeElement === el) el.blur(); }, 50); // certains téléphones ignorent le premier
  };
  // petit formulaire invisible autour du champ (sans effet sur la mise en page) : la loupe le « valide ».
  // Jamais pendant la saisie : déplacer le champ lui ferait perdre le curseur (fait dès qu'il le quitte).
  const envelopper = el => {
    if (el.form || !el.parentNode || document.activeElement === el) return;
    const f = document.createElement("form");
    f.style.display = "contents";
    f.setAttribute("action", "#");
    f.addEventListener("submit", e => { e.preventDefault(); retirer(el); });
    el.parentNode.insertBefore(f, el);
    f.appendChild(el);
  };
  const preparer = el => {
    if (!estRecherche(el)) return;
    envelopper(el);
    if (el.dataset.clavier) return;
    el.dataset.clavier = "1";
    if (!el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "search");
    el.addEventListener("search", () => retirer(el)); // loupe (Safari, Chrome) ou petite croix d'effacement
    el.addEventListener("change", () => retirer(el)); // valeur validée (Entrée sur Android)
  };
  const tout = () => document.querySelectorAll('input[type="search"]').forEach(preparer);
  document.addEventListener("focusin", e => preparer(e.target)); // champ ajouté plus tard
  document.addEventListener("focusout", e => { if (estRecherche(e.target)) setTimeout(() => envelopper(e.target), 0); });
  // Entrée, sous toutes ses formes ; écouté avant les autres (certains l'arrêtent après la recherche)
  const entree = e => (e.key === "Enter" || e.keyCode === 13 || e.which === 13);
  for (const type of ["keydown", "keyup"]) document.addEventListener(type, e => {
    if (entree(e) && estRecherche(e.target)) { const el = e.target; setTimeout(() => retirer(el), 0); }
  }, true);
  document.addEventListener("beforeinput", e => {
    if (estRecherche(e.target) && /^insert(LineBreak|Paragraph)$/.test(e.inputType)) { e.preventDefault(); retirer(e.target); }
  }, true);
  document.addEventListener("input", e => {
    if (!estRecherche(e.target)) return;
    clearTimeout(minuteur);
    if (e.target.value.trim().length >= 2) minuteur = setTimeout(retirer, PAUSE);
  });
  // toucher ailleurs que dans un champ (un résultat, la liste, un bouton…) ou faire défiler l'écran
  const ailleurs = e => {
    const el = document.activeElement;
    if (!estRecherche(el) || e.target === el) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    retirer();
  };
  // (au toucher, le clavier ne part qu'après le clic : retiré avant, il ferait bouger la page sous le doigt)
  document.addEventListener("click", e => setTimeout(() => ailleurs(e), 0));
  document.addEventListener("touchmove", ailleurs, { passive: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tout); else tout();
})();
