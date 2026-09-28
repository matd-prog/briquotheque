// Choix automatique du camp d'une figurine.
// Ordre de priorité : 1) votre Table camps (vos choix priment), 2) même personnage
// déjà classé dans la table, 3) mots-clés, 4) sinon Zone grise.

const MOTS_CLES = [
  // Zone grise d'abord : chasseurs de primes, peuples neutres, mandaloriens...
  ["Zone grise", ["bounty hunter", "chasseur de prime", "boba fett", "jango fett", "bossk", "ig-88", "dengar", "zuckuss", "4-lom",
    "greedo", "cad bane", "aurra sing", "embo", "jawa", "tusken", "sand people", "mandalorian", "din djarin", "bo-katan",
    "gamorrean", "bib fortuna", "jabba", "weequay", "ugnaught", "cantina", "bith", "hondo", "saw gerrera", "fennec", "krrsantan", "ochi"]],
  ["Méchant", ["darth", "sith", "emperor", "palpatine", "stormtrooper", "storm trooper", "scout trooper", "snowtrooper", "sandtrooper",
    "death trooper", "shadow trooper", "tie pilot", "tie fighter pilot", "imperial", "first order", "kylo ren", "snoke", "inquisitor",
    "grand inquisitor", "vader", "maul", "dooku", "grievous", "battle droid", "droideka", "super battle droid", "commando droid",
    "separatist", "tarkin", "krennic", "thrawn", "moff", "phasma", "hux", "nightsister", "ventress", "savage opress", "purge trooper",
    "dark trooper", "magnaguard", "nute gunray", "jar jar darth", "elsbeth", "royal guard", "ap-at", "at-at driver", "at-st driver"]],
  ["Gentil", ["jedi", "luke", "leia", "han solo", "chewbacca", "yoda", "obi-wan", "kenobi", "rebel", "resistance", "republic",
    "clone", "rey", "finn", "poe dameron", "r2-d2", "c-3po", "bb-8", "ewok", "wicket", "lando", "ahsoka", "mace windu", "qui-gon",
    "padme", "padmé", "grogu", "cassian", "jyn", "k-2so", "chirrut", "baze", "hera", "ezra", "kanan", "sabine", "zeb", "chopper",
    "omega", "wedge", "x-wing pilot", "a-wing pilot", "b-wing pilot", "y-wing pilot", "admiral ackbar", "mon mothma", "rose tico",
    "senate commando", "gungan", "naboo", "clone force 99", "wrecker", "crosshair", "cal kestis", "anakin"]],
];

function normaliser(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

// "LUKE SKYWALKER Tatooine" -> "luke skywalker" (les mots en MAJUSCULES forment le nom du personnage)
function nomDePersonnage(personnage) {
  const mots = (personnage || "").split(/\s+/);
  const base = [];
  for (const m of mots) {
    if (/[a-z]/.test(m)) break;
    if (/^[A-Z0-9\-'"().]+$/.test(m)) base.push(m); else break;
  }
  return normaliser(base.join(" ").replace(/\(.*?\)/g, "").replace(/["']/g, ""));
}

function proposerCamp(code, nom, table) {
  const c = (code || "").toUpperCase();
  const deja = table.find(l => l.code.toUpperCase() === c);
  if (deja && CAMPS[deja.camp]) return { camp: deja.camp, raison: "d'après votre Table camps" };

  const n = normaliser(nom);
  const votes = {};
  for (const l of table) {
    const base = nomDePersonnage(l.personnage);
    if (base.length >= 4 && CAMPS[l.camp] && n.includes(base)) votes[l.camp] = (votes[l.camp] || 0) + base.length;
  }
  const meilleur = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (meilleur) return { camp: meilleur[0], raison: "même personnage déjà classé dans votre collection" };

  for (const [camp, mots] of MOTS_CLES)
    if (mots.some(m => n.includes(m))) return { camp, raison: "d'après le nom de la figurine" };

  return { camp: "Zone grise", raison: "camp incertain : gris par défaut, vérifiez" };
}

function estStarWars(candidat) {
  return /^sw/i.test(candidat.id || "") || /star wars/i.test(candidat.categorie || "");
}
