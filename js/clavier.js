// Clavier des champs de recherche (blisters, figurines, sets…) : on tape au clavier, puis le clavier se retire pour
// laisser voir les résultats (demande de Mathias, 08/10/2026). Il se retire :
//  - à la touche « Rechercher » du clavier (Entrée) ;
//  - quand on touche ou fait défiler l'écran en dehors du champ (on regarde les résultats) ;
//  - après une pause de 1,5 s sans taper, les résultats étant déjà affichés au fil de la frappe.
// Toucher le champ fait revenir le clavier. Vaut pour l'appli principale et la mini-appli de l'ami.
(() => {
  const PAUSE = 1500;
  let minuteur = null;
  const estRecherche = el => el && el.tagName === "INPUT" && el.type === "search";
  const retirer = () => {
    clearTimeout(minuteur);
    const el = document.activeElement;
    if (estRecherche(el)) el.blur();
  };
  const preparer = el => { if (estRecherche(el) && !el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", "search"); };
  const tout = () => document.querySelectorAll('input[type="search"]').forEach(preparer);
  document.addEventListener("focusin", e => preparer(e.target));
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && estRecherche(e.target)) setTimeout(retirer, 0); // après la recherche elle-même
  });
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
