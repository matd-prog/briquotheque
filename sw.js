// Permet d'installer l'appli sur l'écran d'accueil et de l'ouvrir même avec un réseau faible.
// Stratégie : toujours essayer Internet d'abord (pour avoir la dernière version), sinon la copie gardée.
// cache: "no-cache" : on redemande toujours au serveur si le fichier a changé (GitHub Pages
// autorise sinon le téléphone à garder une ancienne version 10 minutes)
const CACHE = "briquotheque-v101"; // même numéro que VERSION_APPLI (js/app.js)
self.addEventListener("install", e => self.skipWaiting());
// les copies des versions précédentes sont effacées
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(rep => {
      const copie = rep.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie));
      return rep;
    }).catch(() => caches.match(e.request))
  );
});
