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
  flight_class: [
    { value: 'Economy', label: 'Economy' },
    { value: 'Premium Economy', label: 'Premium Economy' },
    { value: 'Business', label: 'Business' },
    { value: 'Primera', label: 'Primera' },
  ],
  baggage: [
    { value: 'incluidas', label: 'Maletas incluidas' },
    { value: 'carry_on', label: 'Solo equipaje de mano' },
    { value: 'no_incluidas', label: 'Sin maletas' },
  ],
  cabin_type: [
    { value: 'interior', label: 'Interior' },
    { value: 'ocean_view', label: 'Vista al Mar' },
    { value: 'balcony', label: 'Balcón' },
    { value: 'suite', label: 'Suite' },
    { value: 'haven', label: 'Haven / Exclusivo' },
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

// Aerolíneas precargadas — misma lista que Corsario (ServiceForm). Se combinan
// con las que el admin agregue (ServiceDropdownOption categoría 'airline').
export const AIRLINES = [
  'Aer Lingus', 'Aeroflot', 'Aerolineas Argentinas', 'Aeroméxico', 'Air Asia', 'Air Asia X',
  'Air Canada', 'Air Caraïbes', 'Air China', 'Air Europa', 'Air France', 'Air India',
  'Air India Express', 'Air Japan', 'Air Malta', 'Air New Zealand', 'Air Serbia',
  'Air Tahiti Nui', 'Air Transat', 'Alaska Airlines', 'Allegiant Air', 'American Airlines',
  'ANA – All Nippon Airways', 'Asiana Airlines', 'Austrian Airlines', 'Avianca',
  'Azul Brazilian Airlines', 'Batik Air', 'British Airways', 'Brussels Airlines',
  'Bulgaria Air', 'Cabo Verde Airlines', 'Cathay Pacific', 'Cebu Pacific', 'China Airlines',
  'China Eastern', 'China Southern', 'Condor', 'Copa Airlines', 'Corsair', 'Croatia Airlines',
  'Delta Air Lines', 'EasyJet', 'Edelweiss Air', 'EgyptAir', 'El Al', 'Emirates',
  'Ethiopian Airlines', 'Etihad Airways', 'Eurowings', 'EVA Air', 'Fiji Airways', 'Finnair',
  'Flair Airlines', 'FlyDubai', 'Frontier Airlines', 'Garuda Indonesia', 'Gol Linhas Aéreas',
  'Gulf Air', 'Hainan Airlines', 'Hawaiian Airlines', 'Iberia', 'Icelandair', 'IndiGo',
  'ITA Airways', 'Japan Airlines (JAL)', 'Jeju Air', 'JetBlue', 'Jetstar', 'KLM', 'Korean Air',
  'Kuwait Airways', 'La Compagnie', 'LATAM Airlines', 'Lion Air', 'LOT Polish Airlines',
  'Lufthansa', 'Luxair', 'Malaysia Airlines', 'Middle East Airlines (MEA)', 'Norwegian Air',
  'Oman Air', 'Philippine Airlines', 'Porter Airlines', 'Qantas', 'Qatar Airways',
  'Royal Air Maroc', 'Royal Brunei Airlines', 'Royal Jordanian', 'Ryanair', 'S7 Airlines',
  'Saudia', 'Scandinavian Airlines (SAS)', 'Scoot', 'Shenzhen Airlines', 'Singapore Airlines',
  'Sky Airline', 'South African Airways', 'Southwest Airlines', 'SpiceJet', 'Spirit Airlines',
  'SriLankan Airlines', 'Sun Country Airlines', 'Swiss International Air Lines', 'TAP Air Portugal',
  'TAROM', 'Thai Airways', 'Transavia', 'Turkish Airlines', 'United Airlines', 'Uzbekistan Airways',
  'VietJet Air', 'Vietnam Airlines', 'Virgin Atlantic', 'Virgin Australia', 'Viva Aerobus',
  'Volaris', 'Vueling', 'WestJet', 'Wizz Air', 'XiamenAir',
];
export const AIRLINE_OPTIONS = AIRLINES.map((a) => ({ value: a, label: a }));

// Líneas de crucero (navieras) — misma lista y valores que Corsario, para que
// al Vender el valor case 1:1. Se combinan con las de admin (categoría 'cruise_line').
export const CRUISE_LINES = [
  { value: 'royal_caribbean', label: 'Royal Caribbean' }, { value: 'carnival', label: 'Carnival Cruise Line' },
  { value: 'norwegian', label: 'Norwegian Cruise Line' }, { value: 'msc', label: 'MSC Cruceros' },
  { value: 'princess', label: 'Princess Cruises' }, { value: 'celebrity', label: 'Celebrity Cruises' },
  { value: 'holland_america', label: 'Holland America Line' }, { value: 'disney', label: 'Disney Cruise Line' },
  { value: 'virgin_voyages', label: 'Virgin Voyages' }, { value: 'costa', label: 'Costa Cruceros' },
  { value: 'cunard', label: 'Cunard' }, { value: 'silversea', label: 'Silversea' },
  { value: 'regent', label: 'Regent Seven Seas' }, { value: 'oceania', label: 'Oceania Cruises' },
  { value: 'seabourn', label: 'Seabourn' }, { value: 'viking', label: 'Viking Ocean Cruises' },
  { value: 'azamara', label: 'Azamara' }, { value: 'explora', label: 'Explora Journeys' },
  { value: 'ritz_carlton_yacht', label: 'Ritz-Carlton Yacht Collection' }, { value: 'windstar', label: 'Windstar Cruises' },
  { value: 'ponant', label: 'Ponant' }, { value: 'hurtigruten', label: 'Hurtigruten' },
];

// Barcos precargados (lista curada de las principales navieras de lujo/premium).
// En Corsario el barco es texto libre, así que aquí guardamos el NOMBRE tal cual
// (value = label). Crece con lo que el admin agregue (categoría 'cruise_ship').
const SHIP_NAMES = [
  // Explora Journeys
  'Explora I', 'Explora II',
  // Regent Seven Seas
  'Seven Seas Explorer', 'Seven Seas Splendor', 'Seven Seas Grandeur', 'Seven Seas Mariner', 'Seven Seas Voyager', 'Seven Seas Navigator',
  // Silversea
  'Silver Nova', 'Silver Ray', 'Silver Moon', 'Silver Dawn', 'Silver Muse', 'Silver Whisper', 'Silver Shadow',
  // Seabourn
  'Seabourn Ovation', 'Seabourn Encore', 'Seabourn Sojourn', 'Seabourn Quest', 'Seabourn Pursuit', 'Seabourn Venture',
  // Oceania
  'Vista', 'Allura', 'Marina', 'Riviera', 'Sirena', 'Nautica', 'Insignia', 'Regatta',
  // Viking Ocean
  'Viking Star', 'Viking Sky', 'Viking Sea', 'Viking Jupiter', 'Viking Venus', 'Viking Neptune',
  // Ritz-Carlton Yacht Collection
  'Evrima', 'Ilma', 'Luminara',
  // Ponant
  'Le Commandant Charcot', 'Le Bougainville', 'Le Lapérouse', 'Le Bellot', 'Le Dumont-d’Urville',
  // Cunard
  'Queen Mary 2', 'Queen Victoria', 'Queen Elizabeth', 'Queen Anne',
  // Virgin Voyages
  'Scarlet Lady', 'Valiant Lady', 'Resilient Lady', 'Brilliant Lady',
  // Celebrity
  'Celebrity Beyond', 'Celebrity Apex', 'Celebrity Edge', 'Celebrity Ascent',
  // Royal Caribbean
  'Icon of the Seas', 'Utopia of the Seas', 'Wonder of the Seas', 'Symphony of the Seas',
  // Norwegian
  'Norwegian Prima', 'Norwegian Viva', 'Norwegian Aqua',
  // Disney
  'Disney Wish', 'Disney Treasure', 'Disney Fantasy', 'Disney Dream',
];
export const CRUISE_SHIP_OPTIONS = SHIP_NAMES.map((s) => ({ value: s, label: s }));

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
    esencial: [
      { key: 'airline', label: 'Aerolínea', kind: 'catalog', catalog: 'airline', baseOptions: AIRLINE_OPTIONS, meta: true },
      m('route', 'Ruta'),
      m('flight_class', 'Clase', 'select', SELECTS.flight_class),
      { key: 'departure', label: 'Salida (día del itinerario)', kind: 'readonly_date', meta: true },
      m('departure_time', 'Hora de salida', 'time'),
      { key: 'arrival_date', label: 'Fecha de llegada', kind: 'arrival', meta: true },
      m('arrival_time', 'Hora de llegada', 'time'),
      m('layover', 'Tiempo en conexión (escala)'),
    ],
    operar: [m('flight_number', '# Vuelo'), m('baggage', 'Maletas', 'select', SELECTS.baggage), m('seats', 'Asientos'), m('passengers', 'Pasajeros', 'number'), m('flight_reservation_number', '# Reserva')],
  },
  traslado: {
    esencial: [m('transfer_type', 'Tipo', 'select', SELECTS.transfer_type), m('transfer_origin', 'Origen'), m('transfer_destination', 'Destino'), m('max_luggage', 'Maletas (máximo)', 'number')],
    operar: [m('vehicle', 'Vehículo'), m('transfer_datetime', 'Fecha y hora', 'datetime'), m('transfer_passengers', 'Pasajeros', 'number')],
  },
  tour: {
    esencial: [m('tour_name', 'Tour'), m('tour_city', 'Ciudad'), m('tour_date', 'Fecha', 'date')],
    operar: [m('tour_duration', 'Duración'), m('tour_includes', 'Incluye', 'textarea'), m('tour_people', 'Personas', 'number'), m('tour_reservation_number', '# Reserva')],
  },
  crucero: {
    esencial: [
      { key: 'cruise_line', label: 'Línea (naviera)', kind: 'catalog', catalog: 'cruise_line', baseOptions: CRUISE_LINES, meta: true },
      { key: 'cruise_ship', label: 'Barco', kind: 'catalog', catalog: 'cruise_ship', baseOptions: CRUISE_SHIP_OPTIONS, valueIsLabel: true, meta: true },
      m('cruise_nights', 'Noches', 'number'),
    ],
    operar: [m('cruise_itinerary', 'Itinerario', 'textarea'), m('cruise_departure_port', 'Puerto de salida'), m('cruise_arrival_port', 'Puerto de llegada'), m('cruise_departure_date', 'Fecha de salida', 'date'), m('cruise_arrival_date', 'Fecha de llegada', 'date'), m('cruise_cabin_type', 'Tipo de cabina', 'select', SELECTS.cabin_type), m('cruise_cabin_number', '# Cabina'), m('cruise_passengers', 'Pasajeros', 'number'), m('cruise_reservation_number', '# Reserva')],
  },
  tren: {
    esencial: [
      m('train_operator', 'Operador'),
      m('train_route', 'Ruta'),
      m('train_departure_time', 'Hora de salida', 'time'),
      m('train_arrival_time', 'Hora de llegada', 'time'),
      m('train_class', 'Clase'),
      m('train_transfers', 'Trasbordos', 'number'),
    ],
    operar: [m('train_number', '# Tren'), m('train_date', 'Fecha', 'date'), m('train_passengers', 'Pasajeros', 'number'), m('train_reservation_number', '# Reserva')],
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
