// Fuente única de verdad para los métodos de pago en toda la plataforma.
// Los "value" son las claves que se guardan en la base de datos — NO cambiarlas
// (rompería datos existentes). Los "label" son el texto que se muestra: mantener
// UNA sola redacción por método aquí y usar estos exports en todos lados.

// Cómo el CLIENTE le paga a Nomad
export const CLIENT_PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'link_pago', label: 'Link de Pago' },
  { value: 'tarjeta_cliente', label: 'Tarjeta del Cliente' },
];

// Cómo Nomad le paga a los PROVEEDORES
export const SUPPLIER_PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ms_beyond', label: 'MS Beyond' },
  { value: 'capital_one_blue', label: 'Capital One Blue' },
  { value: 'capital_one_green', label: 'Capital One Green' },
  { value: 'amex', label: 'American Express' },
  { value: 'amex_verde', label: 'American Express Verde' },
  { value: 'tarjeta_cliente', label: 'Tarjeta del Cliente' },
];

// Unión sin duplicados (para filtros/buscadores que abarcan cliente + proveedor)
export const ALL_PAYMENT_METHODS = (() => {
  const seen = new Set();
  const out = [];
  for (const m of [...CLIENT_PAYMENT_METHODS, ...SUPPLIER_PAYMENT_METHODS]) {
    if (seen.has(m.value)) continue;
    seen.add(m.value);
    out.push(m);
  }
  return out;
})();

// Etiquetas de valores legados que pueden existir en datos antiguos, para que
// nunca se muestre la clave cruda aunque ya no se ofrezcan como opción nueva.
const LEGACY_LABELS = {
  tarjeta: 'Tarjeta',
  wise: 'Wise',
  zelle: 'Zelle',
  paypal: 'PayPal',
  cheque: 'Cheque',
  otro: 'Otro',
};

// Mapa unificado value -> label para MOSTRAR cualquier método guardado
export const PAYMENT_METHOD_LABELS = {
  ...LEGACY_LABELS,
  ...Object.fromEntries(ALL_PAYMENT_METHODS.map(m => [m.value, m.label])),
};

export const paymentMethodLabel = (value) => PAYMENT_METHOD_LABELS[value] || value || '—';

// Concepto DISTINTO: qué formas de pago ACEPTA un proveedor (en su perfil).
// No es cómo Nomad paga, sino lo que el proveedor admite recibir.
export const SUPPLIER_ACCEPTED_METHODS = [
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'link_pago', label: 'Link de Pago' },
  { value: 'pago_destino', label: 'Pago en destino' },
];

export const SUPPLIER_ACCEPTED_METHOD_LABELS = Object.fromEntries(
  SUPPLIER_ACCEPTED_METHODS.map(m => [m.value, m.label])
);
