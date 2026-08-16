// Catálogo de ciudades para el Cotizador.
// - Lista semilla curada (crece sola: lo que se agrega se guarda en la BD como
//   ServiceDropdownOption categoría 'city').
// - Búsqueda tolerante: sin acentos, con typos (distancia de edición) y alias
//   español/inglés ("cambodia" → "Camboya", "tokio" → "Tokyo").

export const SEED_CITIES = [
  // México
  'Ciudad de México, México', 'Cancún, México', 'Los Cabos, México', 'Tulum, México', 'Playa del Carmen, México',
  'Puerto Vallarta, México', 'Monterrey, México', 'Guadalajara, México', 'Oaxaca, México', 'San Miguel de Allende, México',
  'Mérida, México', 'Riviera Maya, México', 'Cozumel, México', 'Huatulco, México', 'Guanajuato, México', 'Querétaro, México',
  // Estados Unidos
  'Nueva York, Estados Unidos', 'Los Ángeles, Estados Unidos', 'Miami, Estados Unidos', 'Las Vegas, Estados Unidos',
  'San Francisco, Estados Unidos', 'Orlando, Estados Unidos', 'Chicago, Estados Unidos', 'Washington D.C., Estados Unidos',
  'Boston, Estados Unidos', 'Nueva Orleans, Estados Unidos', 'Seattle, Estados Unidos', 'Honolulu, Estados Unidos',
  'Maui, Estados Unidos', 'San Diego, Estados Unidos', 'Aspen, Estados Unidos', 'Napa, Estados Unidos',
  // Canadá
  'Toronto, Canadá', 'Vancouver, Canadá', 'Montreal, Canadá', 'Quebec, Canadá', 'Banff, Canadá',
  // Caribe y Centroamérica
  'La Habana, Cuba', 'Punta Cana, República Dominicana', 'Santo Domingo, República Dominicana',
  'San José, Costa Rica', 'Ciudad de Panamá, Panamá', 'Ciudad de Guatemala, Guatemala',
  'Aruba, Aruba', 'Nassau, Bahamas', 'Montego Bay, Jamaica', 'San Juan, Puerto Rico',
  // Sudamérica
  'Buenos Aires, Argentina', 'Bariloche, Argentina', 'Mendoza, Argentina', 'Ushuaia, Argentina',
  'Río de Janeiro, Brasil', 'São Paulo, Brasil', 'Lima, Perú', 'Cusco, Perú', 'Machu Picchu, Perú',
  'Cartagena, Colombia', 'Bogotá, Colombia', 'Medellín, Colombia', 'Santiago, Chile', 'Quito, Ecuador',
  'Islas Galápagos, Ecuador', 'Montevideo, Uruguay', 'La Paz, Bolivia',
  // Europa occidental
  'París, Francia', 'Niza, Francia', 'Burdeos, Francia', 'Cannes, Francia', 'Lyon, Francia',
  'Londres, Reino Unido', 'Edimburgo, Reino Unido', 'Dublín, Irlanda', 'Ámsterdam, Países Bajos',
  'Bruselas, Bélgica', 'Lisboa, Portugal', 'Oporto, Portugal',
  'Madrid, España', 'Barcelona, España', 'Sevilla, España', 'Granada, España', 'Valencia, España',
  'San Sebastián, España', 'Palma de Mallorca, España', 'Ibiza, España',
  'Ginebra, Suiza', 'Zúrich, Suiza', 'Lucerna, Suiza', 'Interlaken, Suiza', 'Zermatt, Suiza',
  'Viena, Austria', 'Salzburgo, Austria', 'Múnich, Alemania', 'Berlín, Alemania', 'Frankfúrt, Alemania', 'Hamburgo, Alemania',
  // Europa sur y este
  'Roma, Italia', 'Florencia, Italia', 'Venecia, Italia', 'Milán, Italia', 'Nápoles, Italia',
  'Costa Amalfitana, Italia', 'Positano, Italia', 'Lago de Como, Italia', 'Cerdeña, Italia', 'Sicilia, Italia',
  'Atenas, Grecia', 'Santorini, Grecia', 'Mykonos, Grecia', 'Creta, Grecia',
  'Estambul, Turquía', 'Capadocia, Turquía', 'Praga, República Checa', 'Budapest, Hungría',
  'Dubrovnik, Croacia', 'Split, Croacia', 'Varsovia, Polonia', 'Cracovia, Polonia',
  'Reikiavik, Islandia', 'Copenhague, Dinamarca', 'Estocolmo, Suecia', 'Oslo, Noruega', 'Helsinki, Finlandia',
  // Medio Oriente
  'Dubái, Emiratos Árabes', 'Abu Dabi, Emiratos Árabes', 'Doha, Catar', 'Ammán, Jordania', 'Petra, Jordania',
  'Jerusalén, Israel', 'Tel Aviv, Israel', 'Mascate, Omán',
  // África
  'El Cairo, Egipto', 'Marrakech, Marruecos', 'Fez, Marruecos', 'Casablanca, Marruecos',
  'Ciudad del Cabo, Sudáfrica', 'Johannesburgo, Sudáfrica', 'Nairobi, Kenia', 'Serengeti, Tanzania',
  'Zanzíbar, Tanzania', 'Isla Mauricio, Mauricio', 'Seychelles, Seychelles',
  // Asia
  'Tokyo, Japón', 'Kyoto, Japón', 'Osaka, Japón', 'Hakone, Japón', 'Nara, Japón', 'Hiroshima, Japón', 'Sapporo, Japón',
  'Seúl, Corea del Sur', 'Busan, Corea del Sur', 'Beijing, China', 'Shanghái, China', 'Hong Kong, Hong Kong', 'Taipéi, Taiwán',
  'Bangkok, Tailandia', 'Phuket, Tailandia', 'Chiang Mai, Tailandia', 'Krabi, Tailandia',
  'Singapur, Singapur', 'Kuala Lumpur, Malasia',
  'Bali, Indonesia', 'Ubud, Indonesia', 'Yakarta, Indonesia',
  'Hanoi, Vietnam', 'Ha Long, Vietnam', 'Ho Chi Minh, Vietnam', 'Hoi An, Vietnam',
  'Siem Reap, Camboya', 'Phnom Penh, Camboya', 'Luang Prabang, Laos',
  'Katmandú, Nepal', 'Nueva Delhi, India', 'Agra, India', 'Jaipur, India', 'Bombay, India', 'Goa, India',
  'Colombo, Sri Lanka', 'Malé, Maldivas', 'Maldivas, Maldivas',
  // Oceanía
  'Sídney, Australia', 'Melbourne, Australia', 'Auckland, Nueva Zelanda', 'Queenstown, Nueva Zelanda',
  'Bora Bora, Polinesia Francesa', 'Papeete, Polinesia Francesa', 'Nadi, Fiyi',
];

// Alias (normalizados) → término normalizado que sí aparece en el catálogo.
const ALIASES = {
  // países (inglés → español)
  japan: 'japon', china: 'china', cambodia: 'camboya', france: 'francia', italy: 'italia',
  spain: 'espana', greece: 'grecia', egypt: 'egipto', morocco: 'marruecos', turkey: 'turquia',
  germany: 'alemania', austria: 'austria', switzerland: 'suiza', netherlands: 'paises bajos',
  holland: 'paises bajos', belgium: 'belgica', portugal: 'portugal', ireland: 'irlanda',
  scotland: 'reino unido', iceland: 'islandia', denmark: 'dinamarca', sweden: 'suecia',
  norway: 'noruega', finland: 'finlandia', poland: 'polonia', 'czech republic': 'republica checa',
  hungary: 'hungria', croatia: 'croacia', jordan: 'jordania', israel: 'israel', qatar: 'catar',
  oman: 'oman', kenya: 'kenia', tanzania: 'tanzania', 'south africa': 'sudafrica', india: 'india',
  'sri lanka': 'sri lanka', nepal: 'nepal', 'south korea': 'corea del sur', korea: 'corea del sur',
  taiwan: 'taiwan', philippines: 'filipinas', malaysia: 'malasia', laos: 'laos',
  'new zealand': 'nueva zelanda', australia: 'australia', fiji: 'fiyi', chile: 'chile',
  brazil: 'brasil', colombia: 'colombia', ecuador: 'ecuador', uruguay: 'uruguay', bolivia: 'bolivia',
  cuba: 'cuba', 'dominican republic': 'republica dominicana', 'costa rica': 'costa rica',
  panama: 'panama', canada: 'canada', 'united states': 'estados unidos', usa: 'estados unidos',
  us: 'estados unidos', uk: 'reino unido', england: 'reino unido', thailand: 'tailandia',
  indonesia: 'indonesia', vietnam: 'vietnam', singapore: 'singapur', maldives: 'maldivas',
  'united arab emirates': 'emiratos arabes', argentina: 'argentina',
  // ciudades (inglés/variantes → español)
  tokio: 'tokyo', 'new york': 'nueva york', rome: 'roma', florence: 'florencia', venice: 'venecia',
  milan: 'milan', naples: 'napoles', london: 'londres', athens: 'atenas', cairo: 'cairo',
  'cape town': 'ciudad del cabo', 'mexico city': 'ciudad de mexico', bombay: 'mumbai',
  peking: 'beijing', saigon: 'ho chi minh', seoul: 'seul', munich: 'munich', vienna: 'viena',
  prague: 'praga', warsaw: 'varsovia', lisbon: 'lisboa', geneva: 'ginebra', zurich: 'zurich',
  cologne: 'colonia', copenhagen: 'copenhague', stockholm: 'estocolmo', reykjavik: 'reikiavik',
  marrakesh: 'marrakech', jerusalem: 'jerusalen', florencia: 'florencia', edinburgh: 'edimburgo',
  dublin: 'dublin', amsterdam: 'amsterdam', sydney: 'sidney', 'phnom penh': 'phnom penh',
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
