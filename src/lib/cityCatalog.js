// Catálogo de ciudades para el Cotizador.
// - Lista semilla curada (crece sola: lo que se agrega se guarda en la BD como
//   ServiceDropdownOption categoría 'city').
// - Búsqueda tolerante: sin acentos, con typos (distancia de edición) y alias
//   español/inglés ("cambodia" → "Camboya", "tokio" → "Tokyo").

export const SEED_CITIES = [
  'Tokyo, Japón', 'Kyoto, Japón', 'Osaka, Japón', 'Hakone, Japón', 'Nara, Japón', 'Hiroshima, Japón', 'Sapporo, Japón',
  'Hanoi, Vietnam', 'Ha Long, Vietnam', 'Ho Chi Minh, Vietnam', 'Hoi An, Vietnam',
  'Ubud, Indonesia', 'Bali, Indonesia', 'Yakarta, Indonesia',
  'Singapur, Singapur',
  'Bangkok, Tailandia', 'Phuket, Tailandia', 'Chiang Mai, Tailandia',
  'Siem Reap, Camboya', 'Phnom Penh, Camboya',
  'París, Francia', 'Niza, Francia', 'Burdeos, Francia',
  'Roma, Italia', 'Florencia, Italia', 'Venecia, Italia', 'Milán, Italia',
  'Madrid, España', 'Barcelona, España', 'Sevilla, España',
  'Londres, Reino Unido',
  'Atenas, Grecia', 'Santorini, Grecia', 'Mykonos, Grecia',
  'Nueva York, Estados Unidos', 'Los Ángeles, Estados Unidos', 'Miami, Estados Unidos', 'Las Vegas, Estados Unidos', 'San Francisco, Estados Unidos',
  'Ciudad de México, México', 'Cancún, México', 'Los Cabos, México', 'Tulum, México', 'Monterrey, México',
  'Dubái, Emiratos Árabes',
  'Estambul, Turquía', 'El Cairo, Egipto', 'Marrakech, Marruecos', 'Ciudad del Cabo, Sudáfrica',
  'Buenos Aires, Argentina', 'Río de Janeiro, Brasil', 'Cusco, Perú', 'Lima, Perú', 'Cartagena, Colombia', 'Maldivas, Maldivas',
];

// Alias (normalizados) → término normalizado que sí aparece en el catálogo.
const ALIASES = {
  japan: 'japon', cambodia: 'camboya', france: 'francia', italy: 'italia', spain: 'espana',
  greece: 'grecia', egypt: 'egipto', morocco: 'marruecos', turkey: 'turquia',
  'united states': 'estados unidos', usa: 'estados unidos', us: 'estados unidos',
  uk: 'reino unido', england: 'reino unido', thailand: 'tailandia', brazil: 'brasil',
  indonesia: 'indonesia', vietnam: 'vietnam', singapore: 'singapur', maldives: 'maldivas',
  'south africa': 'sudafrica', argentina: 'argentina', colombia: 'colombia',
  tokio: 'tokyo', 'new york': 'nueva york', rome: 'roma', florence: 'florencia',
  venice: 'venecia', milan: 'milan', london: 'londres', athens: 'atenas',
  cairo: 'cairo', 'cape town': 'ciudad del cabo', 'mexico city': 'ciudad de mexico',
  'rio de janeiro': 'rio de janeiro', bombay: 'mumbai', peking: 'beijing',
};

// Quita acentos y baja a minúsculas
export const norm = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Distancia de edición (Levenshtein) para tolerar typos
function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur[j + 1] = Math.min(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Une la lista semilla con las de la BD (sin duplicar por texto normalizado)
export function mergeCities(dbValues = []) {
  const seen = new Set();
  const out = [];
  [...SEED_CITIES, ...dbValues].forEach((c) => {
    const k = norm(c);
    if (!c || seen.has(k)) return;
    seen.add(k);
    out.push(c);
  });
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

// Devuelve las ciudades que hacen match, ordenadas por relevancia
export function searchCities(query, cities) {
  const q = norm(query);
  if (!q) return cities.slice(0, 60);
  const terms = [q];
  if (ALIASES[q]) terms.push(ALIASES[q]);
  Object.keys(ALIASES).forEach((k) => { if (k.startsWith(q) && q.length >= 3) terms.push(ALIASES[k]); });

  const scored = [];
  for (const city of cities) {
    const nc = norm(city);
    const words = nc.split(/[\s,]+/).filter(Boolean);
    let best = Infinity;
    for (const term of terms) {
      if (nc.startsWith(term)) best = Math.min(best, 0);
      else if (words.some((w) => w.startsWith(term))) best = Math.min(best, 1);
      else if (nc.includes(term)) best = Math.min(best, 2);
      else {
        const thr = term.length <= 4 ? 1 : 2;
        if (words.some((w) => editDistance(w, term) <= thr)) best = Math.min(best, 3);
      }
    }
    if (best < Infinity) scored.push({ city, best });
  }
  scored.sort((a, b) => a.best - b.best || a.city.localeCompare(b.city, 'es'));
  return scored.slice(0, 60).map((s) => s.city);
}
