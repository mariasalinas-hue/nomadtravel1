// Lógica de precios del Cotizador (fuente única).
//
// Regla (igual que Corsario): `price` guarda SIEMPRE el TOTAL FINAL que paga el
// cliente (= total_price al Vender) y `commission` la comisión de Nomad. El tipo
// (bruto/neto) vive en metadata.payment_type; metadata.commission_auto indica si
// la comisión sigue el 8% automático (solo bruto).
//
//   · Bruto: el precio que se escribe ES el total. Comisión = 8% del total por
//            default, editable. Total final = precio.
//   · Neto:  el precio que se escribe es el neto (costo del proveedor). La comisión
//            se captura aparte. Total final = neto + comisión.

export const DEFAULT_COMMISSION_PCT = 0.08;
const num = (v) => Number(v) || 0;
export const round2 = (n) => Math.round(num(n) * 100) / 100;

// Vista derivada para pintar el bloque de precio.
//   base = número visible en el campo "Precio" (bruto: total, neto: neto)
//   total = total final (lo que paga el cliente) = valor guardado en price
//   auto = la comisión sigue el 8% automático (solo bruto)
export const pricingView = (s) => {
  const pt = s?.metadata?.payment_type === 'neto' ? 'neto' : 'bruto';
  const commission = num(s?.commission);
  const total = num(s?.price);
  const base = pt === 'neto' ? round2(total - commission) : total;
  const auto = pt === 'bruto' && (s?.metadata?.commission_auto ?? (commission === 0));
  return { pt, commission, total, base, auto };
};

// Escribir el campo "Precio" (base): bruto = total, neto = neto.
export const applyBase = (s, input) => {
  const { pt, commission, auto } = pricingView(s);
  const base = round2(input);
  if (pt === 'neto') return { price: round2(base + commission), commission, payment_type: 'neto' };
  const comm = auto ? round2(base * DEFAULT_COMMISSION_PCT) : commission;
  return { price: base, commission: comm, payment_type: 'bruto', commission_auto: auto };
};

// Escribir directamente el TOTAL final (usado en la casilla de la tabla).
export const applyTotal = (s, input) => {
  const { pt, commission, auto } = pricingView(s);
  const total = round2(input);
  if (pt === 'neto') return { price: total, commission, payment_type: 'neto' };
  const comm = auto ? round2(total * DEFAULT_COMMISSION_PCT) : commission;
  return { price: total, commission: comm, payment_type: 'bruto', commission_auto: auto };
};

// Editar la comisión a mano.
export const applyCommission = (s, input) => {
  const { pt, base } = pricingView(s);
  const commission = round2(input);
  // En bruto, tocar la comisión la vuelve manual (deja de seguir el 8%).
  if (pt === 'neto') return { commission, price: round2(base + commission), payment_type: 'neto' };
  return { commission, payment_type: 'bruto', commission_auto: false };
};

// Cambiar bruto/neto manteniendo el número visible en "Precio" (= base).
export const applyType = (s, nextPt) => {
  const { base, commission } = pricingView(s);
  if (nextPt === 'neto') return { payment_type: 'neto', price: round2(base + commission), commission, commission_auto: false };
  // A bruto: la base pasa a ser el total y la comisión vuelve al 8% automático.
  return { payment_type: 'bruto', price: base, commission: round2(base * DEFAULT_COMMISSION_PCT), commission_auto: true };
};
