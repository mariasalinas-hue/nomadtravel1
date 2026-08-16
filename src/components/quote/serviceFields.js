// Campos del panel de detalle del Cotizador — usan EXACTAMENTE los mismos
// nombres (keys) que los servicios de Corsario (ServiceForm), para que al
// Vender todo pase 1:1 sin recapturar. Nada es obligatorio.
//   meta:true  → se guarda en metadata (campos descriptivos por tipo)
//   meta:false → columna base del servicio (price, commission, service_name, notes)

export const SELECTS = {
  meal_plan: [
    { value: 'solo_habitacion', label: 'Solo habitación' },
    { value: 'desayuno', label: 'Desayuno' },
    { value: 'all_inclusive', label: 'All inclusive' },
  ],
  transfer_type: [
    { value: 'privado', label: 'Privado' },
    { value: 'compartido', label: 'Compartido' },
  ],
  payment_type: [
    { value: 'bruto', label: 'Bruto' },
    { value: 'neto', label: 'Neto' },
  ],
  booked_by: [
    { value: 'iata_nomad', label: 'Nomad' },
    { value: 'montecito', label: 'Montecito' },
  ],
  reserved_by: [
    { value: 'virtuoso', label: 'Virtuoso' }, { value: 'preferred_partner', label: 'Preferred Partner' },
    { value: 'tbo', label: 'TBO' }, { value: 'expedia_taap', label: 'Expedia TAAP' },
    { value: 'ratehawk', label: 'RateHawk' }, { value: 'tablet_hotels', label: 'Tablet Hotels' },
    { value: 'dmc', label: 'DMC' }, { value: 'otro', label: 'Otro' },
  ],
};

// Lista base de cadenas hoteleras (misma que Corsario). Se combina con las que
// el admin agregue (ServiceDropdownOption categoría 'hotel_chain').
export const HOTEL_CHAINS = [
  { value: 'hilton', label: 'Hilton' }, { value: 'marriott', label: 'Marriott Bonvoy' },
  { value: 'hyatt', label: 'Hyatt' }, { value: 'ihg', label: 'IHG' }, { value: 'accor', label: 'Accor' },
  { value: 'kerzner', label: 'Kerzner International' }, { value: 'four_seasons', label: 'Four Seasons' },
  { value: 'rosewood', label: 'Rosewood Hotel Group' }, { value: 'aman', label: 'Aman' },
  { value: 'belmond', label: 'Belmond' }, { value: 'auberge', label: 'Auberge Resorts Collection' },
  { value: 'slh', label: 'SLH – Small Luxury Hotels' }, { value: 'design_hotels', label: 'Design Hotels' },
  { value: 'lhw', label: 'Leading Hotels of the World' }, { value: 'preferred_hotels', label: 'Preferred Hotels' },
  { value: 'rocco_forte', label: 'Rocco Forte' }, { value: 'dorchester', label: 'Dorchester Collection' },
  { value: 'mandarin_oriental', label: 'Mandarin Oriental' }, { value: 'otro', label: 'Otro' },
];

export const AMENITIES = [
  'Desayuno para 2', 'Upgrade de habitación', 'Crédito de hotel', 'Crédito de spa',
  'Late check-out', 'Early check-in', 'Traslado', 'Cena para 2', 'Amenidad de bienvenida',
];

const m = (key, label, kind = 'text', options) => ({ key, label, kind, options, meta: true });

export const TYPE_FIELDS = {
  hotel: {
    esencial: [
      m('hotel_name', 'Hotel'),
      { key: 'check_in', label: 'Check-in (día del itinerario)', kind: 'readonly_date', meta: true },
      { key: 'check_out', label: 'Check-out', kind: 'checkout', meta: true },
      { key: 'nights', label: 'Noches', kind: 'nights', meta: true },
      m('room_type', 'Tipo de habitación'),
      m('num_rooms', '# Habitaciones', 'number'),
      m('meal_plan', 'Plan de alimentos', 'select', SELECTS.meal_plan),
      { key: 'reserved_by', label: 'Programa / Consorcio', kind: 'catalog', catalog: 'hotel_reserved_by', baseOptions: SELECTS.reserved_by, meta: true },
      { key: 'amenities', label: 'Amenidades', kind: 'amenities', meta: true },
    ],
    operar: [
      { key: 'hotel_chain', label: 'Cadena', kind: 'catalog', catalog: 'hotel_chain', baseOptions: HOTEL_CHAINS, meta: true },
      m('hotel_brand', 'Marca'), m('hotel_city', 'Ciudad'), m('reservation_number', '# Reserva'),
    ],
  },
  vuelo: {
    esencial: [m('airline', 'Aerolínea'), m('route', 'Ruta')],
    operar: [m('flight_number', '# Vuelo'), m('flight_date', 'Fecha', 'date'), m('departure_time', 'Salida', 'time'), m('arrival_time', 'Llegada', 'time'), m('flight_class', 'Clase'), m('passengers', 'Pasajeros', 'number'), m('flight_reservation_number', '# Reserva')],
  },
  traslado: {
    esencial: [m('transfer_type', 'Tipo', 'select', SELECTS.transfer_type), m('transfer_origin', 'Origen'), m('transfer_destination', 'Destino')],
    operar: [m('vehicle', 'Vehículo'), m('transfer_datetime', 'Fecha y hora', 'datetime'), m('transfer_passengers', 'Pasajeros', 'number')],
  },
  tour: {
    esencial: [m('tour_name', 'Tour'), m('tour_city', 'Ciudad'), m('tour_date', 'Fecha', 'date')],
    operar: [m('tour_duration', 'Duración'), m('tour_includes', 'Incluye', 'textarea'), m('tour_people', 'Personas', 'number'), m('tour_reservation_number', '# Reserva')],
  },
  crucero: {
    esencial: [m('cruise_line', 'Línea'), m('cruise_ship', 'Barco'), m('cruise_nights', 'Noches', 'number')],
    operar: [m('cruise_itinerary', 'Itinerario', 'textarea'), m('cruise_departure_port', 'Puerto de salida'), m('cruise_arrival_port', 'Puerto de llegada'), m('cruise_departure_date', 'Fecha de salida', 'date'), m('cruise_arrival_date', 'Fecha de llegada', 'date'), m('cruise_cabin_type', 'Tipo de cabina'), m('cruise_cabin_number', '# Cabina'), m('cruise_passengers', 'Pasajeros', 'number'), m('cruise_reservation_number', '# Reserva')],
  },
  tren: {
    esencial: [m('train_operator', 'Operador'), m('train_route', 'Ruta')],
    operar: [m('train_number', '# Tren'), m('train_date', 'Fecha', 'date'), m('train_departure_time', 'Salida', 'time'), m('train_arrival_time', 'Llegada', 'time'), m('train_class', 'Clase'), m('train_passengers', 'Pasajeros', 'number'), m('train_reservation_number', '# Reserva')],
  },
  dmc: {
    esencial: [m('dmc_name', 'DMC'), m('dmc_destination', 'Destino')],
    operar: [m('dmc_services', 'Servicios', 'textarea'), m('dmc_date', 'Fecha', 'date'), m('dmc_passengers', 'Pasajeros', 'number'), m('dmc_reservation_number', '# Reserva')],
  },
  otro: {
    esencial: [m('other_name', 'Nombre'), m('other_description', 'Descripción', 'textarea')],
    operar: [m('other_date', 'Fecha', 'date')],
  },
};

// Comunes a todos, en la sección "Para operar (opcional)"
export const COMMON_OPERAR = [
  m('payment_type', 'Tipo de comisión', 'select', SELECTS.payment_type),
  m('booked_by', 'IATA', 'select', SELECTS.booked_by),
  { key: 'notes', label: 'Notas internas', kind: 'textarea', meta: false },
];
