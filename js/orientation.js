// Sens des photos : l'appareil photo enregistre souvent l'image couchée, avec une indication « à tourner » (EXIF).
// Les images de la page (<img>) en tiennent compte partout, mais sur iPhone (Safari) createImageBitmap ne le fait
// pas toujours : la photo arrivait couchée dans la lecture du nom, le recadrage et les photos gardées.
// Au démarrage, une minuscule photo « à tourner » (4×2, à afficher en 2×4) teste le navigateur ; s'il ne la tourne
// pas, chaque photo (Blob) passe par une image <img> redessinée, qui, elle, est dans le bon sens.
(function () {
  if (!window.createImageBitmap) return;
  const origine = window.createImageBitmap.bind(window);
  const TEST = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDFoooryz7w/9k=";
  const nonTournee = fetch(TEST).then(r => r.blob()).then(b => origine(b))
    .then(i => { const couchee = i.width > i.height; if (i.close) i.close(); return couchee; })
    .catch(() => false);
  const parImage = blob => new Promise((ok, ko) => {
    const u = URL.createObjectURL(blob), img = new Image();
    img.onload = () => { URL.revokeObjectURL(u); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(u); ko(new Error("image illisible")); };
    img.src = u;
  });
  window.createImageBitmap = async function (source, ...reste) {
    if (source instanceof Blob && !reste.length && /^image\/(jpeg|jpg|heic|heif)?$/i.test(source.type || "image/") && await nonTournee) {
      try {
        const img = await parImage(source);
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext("2d").drawImage(img, 0, 0);
        return origine(cv);
      } catch (err) { console.warn("photo : redressement impossible", err); }
    }
    return origine(source, ...reste);
  };
})();
