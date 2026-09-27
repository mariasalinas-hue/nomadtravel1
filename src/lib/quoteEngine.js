// Lógica pura del cotizador day-by-day (sin UI, sin Supabase). Todo en USD.
// Trabaja sobre una cotización normalizada: { pax, start_date, end_date, rules,
// days: [{ id, day_index, date, city, is_free, services: [{...}] }] }.

export const SERVICE_TYPES = {
  hotel:    { label: 'Hospedaje', key: 'h' },
  vuelo:    { label: 'Vuelo',     key: 'v' },
  crucero:  { label: 'Crucero',   key: 'c' },
  tour:     { label: 'Tour',      key: 't' },
  traslado: { label: 'Traslado',  key: 'r' },
  tren:     { label: 'Tren',      key: 'n' },
  dmc:      { label: 'DMC',       key: 'd' },
  otro:     { label: 'Otro',      key: 'o' },
};
export const TYPE_ORDER = ['hotel', 'vuelo', 'crucero', 'tour', 'traslado', 'tren', 'dmc', 'otro'];

// Reglas de markup por default (se pueden sobrescribir por cotización).
export const DEFAULT_RULES = {
  hotel:    { mode: 'div',     value: 0.90 },
  vuelo:    { mode: 'per_pax', value: 30 },
  crucero:  { mode: 'div',     value: 0.85 },
  tour:     { mode: 'div',     value: 0.85 },
  traslado: { mode: 'div',     value: 0.85 },
  tren:     { mode: 'div',     value: 0.85 },
  dmc:      { mode: 'div',     value: 0.85 },
  otro:     { mode: 'div',     value: 0.85 },
};
export const COMMISSION_PCT = 0.085;

// ---- fechas ----
export const isoAddDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (start, end) => {
  if (!start || !end) return 1;
  const a = new Date(`${start}T12:00:00`), b = new Date(`${end}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 864e5) + 1);
};
export const dateForIndex = (start, i) => (start ? isoAddDays(start, i) : null);

// ---- precios ----
export const rulesFor = (quote) => ({ ...DEFAULT_RULES, ...(quote?.markup_overrides || {}) });

export function grossFromNet(service, rules, pax) {
  const r = rules?.[service.type] || DEFAULT_RULES[service.type];
  const net = Number(service.net) || 0;
  if (r.mode === 'per_pax') return net + (Number(r.value) || 0) * (Number(pax) || 0);
  return Number(r.value) > 0 ? net / Number(r.value) : net;
}

export function commissionOf(service) {
  const gross = Number(service.gross) || 0;
  if (service.price_mode === 'net') return gross - (Number(service.net) || 0);
  return gross * COMMISSION_PCT;
}

// ---- hoteles multinoche: mapa dayIndex -> { service, night, of } para los días
// que un hotel de N noches cubre DESPUÉS de su día de captura ----
export function hotelCover(days) {
  const map = {};
  days.forEach((d, i) => (d.services || []).forEach(s => {
    if (s.type !== 'hotel') return;
    const nights = Number(s.nights) || 1;
    for (let k = 1; k < nights; k++) {
      if (i + k < days.length) map[i + k] = { service: s, night: k + 1, of: nights };
    }
  }));
  return map;
}

// ---- totales: por tipo, suma del grupo y comisión total (cada servicio cuenta
// una sola vez, en su día de captura) ----
export function totals(days) {
  const byType = {};
  TYPE_ORDER.forEach(k => { byType[k] = 0; });
  let commission = 0;
  days.forEach(d => (d.services || []).forEach(s => {
    byType[s.type] = (byType[s.type] || 0) + (Number(s.gross) || 0);
    commission += commissionOf(s);
  }));
  const sum = Object.values(byType).reduce((a, b) => a + b, 0);
  return { byType, sum, commission };
}

// ---- faltantes: mismos criterios que el prototipo ----
export function missing(days) {
  const out = [];
  const cover = hotelCover(days);
  const last = days.length - 1;
  days.forEach((d, i) => {
    const services = d.services || [];
    const has = (k) => services.some(s => s.type === k);
    if (i < last && !has('hotel') && !cover[i]) out.push({ i, msg: `Día ${i + 1} sin hospedaje` });
    if (i === 0 && !has('vuelo') && !has('traslado')) out.push({ i, msg: 'Día 1 sin vuelo o traslado de llegada' });
    if (i === last && !has('traslado') && !has('vuelo')) out.push({ i, msg: `Día ${i + 1} sin traslado de salida` });
    if (!d.is_free && !services.length && !cover[i]) out.push({ i, msg: `Día ${i + 1} vacío (márcalo libre si aplica)` });
    services.forEach(s => { if (!(Number(s.gross) > 0)) out.push({ i, msg: `Precio pendiente: ${s.name || SERVICE_TYPES[s.type].label}` }); });
  });
  return out;
}

export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
