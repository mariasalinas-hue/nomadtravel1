import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, ChevronsUpDown, Sparkles, Upload } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useServiceDropdownOptions } from '@/hooks/useServiceDropdownOptions';
import { supabaseAPI, supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

const SERVICE_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'vuelo', label: 'Vuelo' },
  { value: 'traslado', label: 'Traslado' },
  { value: 'tour', label: 'Tour' },
  { value: 'crucero', label: 'Crucero' },
  { value: 'tren', label: 'Tren' },
  { value: 'dmc', label: 'DMC' },
  { value: 'otro', label: 'Otro' }
];

const MEAL_PLANS = [
  { value: 'solo_habitacion', label: 'Solo Habitación' },
  { value: 'desayuno', label: 'Desayuno Incluido' },
  { value: 'all_inclusive', label: 'All Inclusive' }
];

const BOOKED_BY = [
  { value: 'montecito', label: 'Montecito' },
  { value: 'iata_nomad', label: 'Nomad' }
];

const PAYMENT_TYPE = [
  { value: 'bruto', label: 'Bruto' },
  { value: 'neto', label: 'Neto' }
];

const FLIGHT_CONSOLIDATORS = {
  montecito: [{ value: 'ytc', label: 'YTC' }],
  iata_nomad: [
    { value: 'directo', label: 'Directo' },
    { value: 'ez_travel', label: 'EZ Travel' },
    { value: 'lozano_travel', label: 'Lozano Travel' },
    { value: 'consofly', label: 'Consofly' }
  ]
};

const RESERVED_BY = [
  { value: 'virtuoso', label: 'Virtuoso' },
  { value: 'preferred_partner', label: 'Preferred Partner' },
  { value: 'tbo', label: 'TBO' },
  { value: 'expedia_taap', label: 'Expedia TAAP' },
  { value: 'ratehawk', label: 'RateHawk' },
  { value: 'tablet_hotels', label: 'Tablet Hotels' },
  { value: 'dmc', label: 'DMC' },
  { value: 'otro', label: 'Otro' }
];

const AIRLINES = [
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
  'Volaris', 'Vueling', 'WestJet', 'Wizz Air', 'XiamenAir', 'Otro'
];

const HOTEL_CHAINS = [
  { value: 'hilton', label: 'Hilton' },
  { value: 'marriott', label: 'Marriott Bonvoy' },
  { value: 'hyatt', label: 'Hyatt' },
  { value: 'ihg', label: 'IHG' },
  { value: 'accor', label: 'Accor' },
  { value: 'kerzner', label: 'Kerzner International' },
  { value: 'four_seasons', label: 'Four Seasons' },
  { value: 'rosewood', label: 'Rosewood Hotel Group' },
  { value: 'aman', label: 'Aman' },
  { value: 'belmond', label: 'Belmond' },
  { value: 'auberge', label: 'Auberge Resorts Collection' },
  { value: 'slh', label: 'SLH – Small Luxury Hotels of the World' },
  { value: 'design_hotels', label: 'Design Hotels' },
  { value: 'lhw', label: 'The Leading Hotels of the World (LHW)' },
  { value: 'preferred_hotels', label: 'Preferred Hotels' },
  { value: 'rocco_forte', label: 'Rocco Forte' },
  { value: 'dorchester', label: 'Dorchester Collection' },
  { value: 'mandarin_oriental', label: 'Mandarin Oriental' },
  { value: 'otro', label: 'Otro' }
];

const CRUISE_LINES = [
  { value: 'royal_caribbean', label: 'Royal Caribbean' },
  { value: 'carnival', label: 'Carnival Cruise Line' },
  { value: 'norwegian', label: 'Norwegian Cruise Line' },
  { value: 'msc', label: 'MSC Cruceros' },
  { value: 'princess', label: 'Princess Cruises' },
  { value: 'celebrity', label: 'Celebrity Cruises' },
  { value: 'holland_america', label: 'Holland America Line' },
  { value: 'disney', label: 'Disney Cruise Line' },
  { value: 'virgin_voyages', label: 'Virgin Voyages' },
  { value: 'costa', label: 'Costa Cruceros' },
  { value: 'cunard', label: 'Cunard' },
  { value: 'silversea', label: 'Silversea' },
  { value: 'regent', label: 'Regent Seven Seas' },
  { value: 'oceania', label: 'Oceania Cruises' },
  { value: 'seabourn', label: 'Seabourn' },
  { value: 'viking', label: 'Viking Ocean Cruises' },
  { value: 'azamara', label: 'Azamara' },
  { value: 'explora', label: 'Explora Journeys' },
  { value: 'ritz_carlton_yacht', label: 'Ritz-Carlton Yacht Collection' },
  { value: 'windstar', label: 'Windstar Cruises' },
  { value: 'ponant', label: 'Ponant' },
  { value: 'hurtigruten', label: 'Hurtigruten' },
  { value: 'otro', label: 'Otro' }
];

const CRUISE_PROVIDERS = [
  { value: 'creative_travel', label: 'Creative Travel' },
  { value: 'directo', label: 'Directo' },
  { value: 'international_cruises', label: 'International Cruises' },
  { value: 'cruceros_57', label: 'Cruceros 57' },
  { value: 'pema', label: 'PeMA' }
];

const TRAIN_PROVIDERS = [
  { value: 'rail_europe', label: 'Rail Europe' },
  { value: 'omio', label: 'Omio' },
  { value: 'klook', label: 'Klook' }
];

const CURRENCIES = [
  { value: 'MXN', label: 'MXN – Peso Mexicano' },
  { value: 'ZAR', label: 'ZAR – Rand Sudafricano' },
  { value: 'USD', label: 'USD – Dólar Estadounidense' },
  { value: 'SGD', label: 'SGD – Dólar de Singapur' },
  { value: 'NZD', label: 'NZD – Dólar Neozelandés' },
  { value: 'JPY', label: 'JPY – Yen Japonés' },
  { value: 'THB', label: 'THB – Baht Tailandés' },
  { value: 'ARS', label: 'ARS – Peso Argentino' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'AUD', label: 'AUD – Dólar Australiano' },
  { value: 'IDR', label: 'IDR – Indonesian Rupiah' },
  { value: 'VND', label: 'VND – Dong Vietnamita' },
  { value: 'AED', label: 'AED – Dubai Dólar' },
  { value: 'SAR', label: 'SAR – Saudi Zar' },
  { value: 'CAD', label: 'CAD – Dólar Canadiense' },
  { value: 'ISK', label: 'ISK – Icelandic Krona' },
  { value: 'GBP', label: 'GBP – Libra Esterlina' }
];

const CABIN_TYPES = [
  { value: 'interior', label: 'Interior' },
  { value: 'ocean_view', label: 'Vista al Mar' },
  { value: 'balcony', label: 'Balcón' },
  { value: 'suite', label: 'Suite' },
  { value: 'haven', label: 'Haven / Exclusivo' }
];

const HOTEL_BRANDS = {
  hilton: [
    { value: 'waldorf_astoria', label: 'Waldorf Astoria' },
    { value: 'conrad', label: 'Conrad' },
    { value: 'lxr', label: 'LXR' },
    { value: 'curio', label: 'Curio Collection' },
    { value: 'tapestry', label: 'Tapestry Collection' },
    { value: 'hilton_hotels', label: 'Hilton Hotels & Resorts' },
    { value: 'doubletree', label: 'DoubleTree' },
    { value: 'otro', label: 'Otro' }
  ],
  marriott: [
    { value: 'ritz_carlton', label: 'Ritz-Carlton' },
    { value: 'st_regis', label: 'St. Regis' },
    { value: 'jw_marriott', label: 'JW Marriott' },
    { value: 'w_hotels', label: 'W Hotels' },
    { value: 'edition', label: 'Edition' },
    { value: 'luxury_collection', label: 'Luxury Collection' },
    { value: 'autograph', label: 'Autograph Collection' },
    { value: 'westin', label: 'Westin' },
    { value: 'sheraton', label: 'Sheraton' },
    { value: 'delta', label: 'Delta' },
    { value: 'otro', label: 'Otro' }
  ],
  hyatt: [
    { value: 'park_hyatt', label: 'Park Hyatt' },
    { value: 'grand_hyatt', label: 'Grand Hyatt' },
    { value: 'hyatt_regency', label: 'Hyatt Regency' },
    { value: 'andaz', label: 'Andaz' },
    { value: 'thompson', label: 'Thompson Hotels' },
    { value: 'alila', label: 'Alila' },
    { value: 'unbound', label: 'Unbound Collection' },
    { value: 'otro', label: 'Otro' }
  ],
  ihg: [
    { value: 'intercontinental', label: 'InterContinental' },
    { value: 'six_senses', label: 'Six Senses' },
    { value: 'regent', label: 'Regent' },
    { value: 'kimpton', label: 'Kimpton' },
    { value: 'vignette', label: 'Vignette Collection' },
    { value: 'hotel_indigo', label: 'Hotel Indigo' },
    { value: 'otro', label: 'Otro' }
  ],
  accor: [
    { value: 'fairmont', label: 'Fairmont' },
    { value: 'raffles', label: 'Raffles' },
    { value: 'sofitel', label: 'Sofitel' },
    { value: 'mgallery', label: 'MGallery' },
    { value: 'mondrian', label: 'Mondrian' },
    { value: 'ennismore', label: 'Ennismore Collection' },
    { value: 'banyan_tree', label: 'Banyan Tree' },
    { value: 'otro', label: 'Otro' }
  ],
  kerzner: [
    { value: 'one_and_only', label: 'One&Only' },
    { value: 'siro', label: 'SIRO' },
    { value: 'atlantis', label: 'Atlantis' },
    { value: 'otro', label: 'Otro' }
  ],
  four_seasons: [
    { value: 'four_seasons', label: 'Four Seasons' },
    { value: 'otro', label: 'Otro' }
  ],
  rosewood: [
    { value: 'rosewood_hotels', label: 'Rosewood Hotels' },
    { value: 'khos', label: 'KHOS' },
    { value: 'new_world', label: 'New World Hotels' },
    { value: 'otro', label: 'Otro' }
  ],
  aman: [
    { value: 'aman_resorts', label: 'Aman Resorts' },
    { value: 'otro', label: 'Otro' }
  ],
  belmond: [
    { value: 'belmond_hotels', label: 'Belmond Hotels & Trains' },
    { value: 'otro', label: 'Otro' }
  ],
  auberge: [
    { value: 'auberge', label: 'Auberge' },
    { value: 'otro', label: 'Otro' }
  ],
  slh: [
    { value: 'slh', label: 'SLH' },
    { value: 'otro', label: 'Otro' }
  ],
  design_hotels: [
    { value: 'design_hotels', label: 'Design Hotels' },
    { value: 'otro', label: 'Otro' }
  ],
  lhw: [
    { value: 'lhw', label: 'LHW' },
    { value: 'otro', label: 'Otro' }
  ],
  preferred_hotels: [
    { value: 'otro', label: 'Otro' }
  ],
  rocco_forte: [
    { value: 'otro', label: 'Otro' }
  ],
  dorchester: [
    { value: 'otro', label: 'Otro' }
  ],
  mandarin_oriental: [
    { value: 'otro', label: 'Otro' }
  ],
  otro: [
    { value: 'otro', label: 'Otro' }
  ]
};

// Merge static options with custom dynamic options from Supabase.
// Dynamic options are appended after static ones, deduplicating by value.
function mergeOptions(staticList, dynamicList, mapFn = (o) => ({ value: o.value, label: o.label })) {
  const staticValues = new Set(staticList.map(o => (typeof o === 'string' ? o : o.value)));
  const extras = dynamicList
    .filter(o => o.is_active && !staticValues.has(o.value))
    .map(mapFn);
  return [...staticList, ...extras];
}

export default function ServiceForm({ open, onClose, service, soldTripId, onSave, isLoading }) {
  const { data: customOptions = [] } = useServiceDropdownOptions();

  // Build merged lists (static + custom) — memoized so render functions below stay stable
  const mergedAirlines = useMemo(() => {
    const customAirlines = customOptions.filter(o => o.category === 'airline');
    const extras = customAirlines
      .filter(o => o.is_active && !AIRLINES.includes(o.label))
      .map(o => o.label);
    return [...AIRLINES, ...extras];
  }, [customOptions]);

  const mergedHotelChains = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'hotel_chain');
    return mergeOptions(HOTEL_CHAINS, custom);
  }, [customOptions]);

  const mergedReservedBy = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'hotel_reserved_by');
    return mergeOptions(RESERVED_BY, custom);
  }, [customOptions]);

  const mergedCruiseLines = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'cruise_line');
    return mergeOptions(CRUISE_LINES, custom);
  }, [customOptions]);

  const mergedCruiseProviders = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'cruise_provider');
    return mergeOptions(CRUISE_PROVIDERS, custom);
  }, [customOptions]);

  const mergedTrainProviders = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'train_provider');
    return mergeOptions(TRAIN_PROVIDERS, custom);
  }, [customOptions]);

  const mergedFlightConsolidatorsNomad = useMemo(() => {
    const custom = customOptions.filter(o => o.category === 'flight_consolidator_nomad');
    return mergeOptions(FLIGHT_CONSOLIDATORS.iata_nomad, custom);
  }, [customOptions]);

  const mergedFlightConsolidators = useMemo(() => ({
    ...FLIGHT_CONSOLIDATORS,
    iata_nomad: mergedFlightConsolidatorsNomad,
  }), [mergedFlightConsolidatorsNomad]);

  const [formData, setFormData] = useState({
    service_type: 'hotel',
    total_price: 0,
    commission: 0,
    booked_by: 'montecito',
    notes: '',
    reservation_status: 'reservado',
    local_currency: 'USD',
    local_amount: 0
  });
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (service) {
      // When editing, merge the base fields with metadata
      const appliedYtcFee = service.metadata?.ytc_fee || service.ytc_fee || 0;
      setFormData({
        ...service,
        ...(service.metadata || {}),
        // El campo muestra el precio base (sin el fee de YTC, que se re-aplica al guardar)
        total_price: Math.max(0, (service.total_price || service.price || 0) - appliedYtcFee),
        local_currency: service.local_currency || (service.metadata?.local_currency) || 'USD',
        local_amount: service.local_amount || (service.metadata?.local_amount) || 0
      });
    } else {
      setFormData({
        service_type: 'hotel',
        total_price: 0,
        commission: 0,
        booked_by: 'montecito',
        notes: '',
        reservation_status: 'reservado',
        local_currency: 'USD',
        local_amount: 0
      });
    }
  }, [service, open]);

  const convertToUSD = async (amount, fromCurrency) => {
    if (!amount || amount <= 0 || fromCurrency === 'USD') return amount;
    
    setConvertingCurrency(true);
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      const data = await response.json();
      const rate = data.rates.USD;
      const convertedAmount = amount * rate;
      const finalAmount = convertedAmount * 1.01; // Apply 1.01 factor
      
      return {
        usdAmount: finalAmount,
        exchangeRate: rate,
        quoteDate: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error converting currency:', error);
      alert('No se pudo obtener el tipo de cambio automático. Puedes escribir el Precio Total (USD) manualmente.');
      return null;
    } finally {
      setConvertingCurrency(false);
    }
  };

  const handleLocalAmountChange = (amount) => {
    updateField('local_amount', amount);
    if (formData.local_currency === 'USD') {
      updateField('total_price', amount);
    }
  };

  const handleConvertToUSD = async () => {
    if (!formData.local_amount || formData.local_amount <= 0) return;
    
    if (formData.local_currency === 'USD') {
      updateField('total_price', formData.local_amount);
      updateField('quote_exchange_rate', 1);
      updateField('quote_date', new Date().toISOString().split('T')[0]);
      return;
    }
    
    const result = await convertToUSD(formData.local_amount, formData.local_currency);
    if (result) {
      updateField('total_price', Math.round(result.usdAmount * 100) / 100);
      updateField('quote_exchange_rate', result.exchangeRate);
      updateField('quote_date', result.quoteDate);
    }
  };

  const handleCurrencyChange = (currency) => {
    updateField('local_currency', currency);
    if (currency === 'USD' && formData.local_amount > 0) {
      updateField('total_price', formData.local_amount);
    }
  };

  // Fee de YTC: $5 USD por pasajero cuando el vuelo se compra vía YTC
  const ytcFee = (formData.service_type === 'vuelo' && formData.flight_consolidator === 'ytc')
    ? (parseInt(formData.passengers) || 0) * 5
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.total_price || formData.total_price <= 0) {
      alert('Por favor ingresa un precio total válido');
      return;
    }

    // El precio que se guarda incluye el fee de YTC (el campo del formulario es el precio base)
    const finalPrice = (parseFloat(formData.total_price) || 0) + ytcFee;

    // Generate service_name based on service type
    let serviceName = '';
    switch (formData.service_type) {
      case 'hotel':
        serviceName = formData.hotel_name || 'Hotel';
        break;
      case 'vuelo': {
        const airlineName = formData.airline === 'Otro' ? (formData.airline_other || 'Vuelo') : (formData.airline || 'Vuelo');
        serviceName = `${airlineName} ${formData.flight_number || ''}`.trim();
        break;
      }
      case 'traslado':
        serviceName = `${formData.transfer_origin || ''} → ${formData.transfer_destination || ''}`.trim() || 'Traslado';
        break;
      case 'tour':
        serviceName = formData.tour_name || 'Tour';
        break;
      case 'crucero':
        serviceName = formData.cruise_ship || formData.cruise_line || 'Crucero';
        break;
      case 'tren':
        serviceName = `${formData.train_operator || 'Tren'} ${formData.train_number || ''}`.trim();
        break;
      case 'dmc':
        serviceName = formData.dmc_name || 'DMC';
        break;
      case 'otro':
        serviceName = formData.other_name || formData.other_description?.substring(0, 50) || 'Servicio';
        break;
      default:
        serviceName = 'Servicio';
    }

    // Separate fields that exist in the table vs metadata
    const baseFields = {
      service_type: formData.service_type,
      service_name: serviceName,
      sold_trip_id: soldTripId,
      price: finalPrice,  // Map total_price (+ fee YTC) to price field
      commission: formData.commission || 0,
      notes: formData.notes || '',
      // These fields might also exist in the table
      payment_date: formData.commission_payment_date || null,
      start_date: formData.check_in || formData.flight_date || formData.tour_date || formData.cruise_departure_date || formData.train_date || formData.dmc_date || formData.other_date || null,
      end_date: formData.check_out || formData.cruise_arrival_date || null,
    };

    // All other fields go into metadata
    const metadata = { ...formData };
    // Guardar el fee de YTC aplicado para poder editar el precio base sin duplicarlo
    metadata.ytc_fee = ytcFee;
    // Remove base/system fields from metadata to avoid duplication and bloat
    [
      'service_type', 'service_name', 'sold_trip_id', 'total_price', 'commission',
      'notes', 'commission_payment_date', 'id', 'price', 'created_date', 'created_by',
      'updated_date', 'start_date', 'end_date', 'payment_date', 'amount_paid_to_supplier',
      'is_deleted', 'metadata'
    ].forEach(key => delete metadata[key]);

    const dataToSave = {
      ...baseFields,
      metadata: metadata
    };

    console.log('Guardando servicio:', dataToSave);
    onSave(dataToSave);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Autollenar el formulario a partir de una foto/PDF (confirmación, voucher, etc.)
  const handleAIExtract = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-subir el mismo archivo
    if (!file) return;

    setAiLoading(true);
    try {
      const { file_url } = await supabaseAPI.storage.uploadFile(file, 'documents');
      const { data, error } = await supabase.functions.invoke('extractServiceData', {
        body: { file_urls: [file_url] },
      });
      if (error) throw error;
      const svc = data?.service;
      if (!svc || typeof svc !== 'object') {
        toast.error('No se pudieron extraer datos del archivo');
        return;
      }

      // Solo aplicamos llaves con valor; el agente revisa y ajusta antes de guardar.
      const cleaned = {};
      Object.entries(svc).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
      });
      ['total_price', 'commission', 'local_amount'].forEach((k) => {
        if (cleaned[k] !== undefined) cleaned[k] = parseFloat(cleaned[k]) || 0;
      });
      if (cleaned.local_currency && cleaned.local_currency !== 'USD') {
        cleaned.local_amount = cleaned.local_amount ?? cleaned.total_price ?? 0;
      }

      setFormData(prev => ({ ...prev, ...cleaned }));
      toast.success('Datos extraídos — revísalos antes de guardar');
    } catch (err) {
      console.error('Error extracting service data:', err);
      toast.error('Error al analizar el archivo');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChainChange = (chain) => {
    setFormData(prev => ({ 
      ...prev, 
      hotel_chain: chain,
      hotel_brand: '' // Reset brand when chain changes
    }));
  };

  const availableBrands = formData.hotel_chain ? HOTEL_BRANDS[formData.hotel_chain] || [] : [];

  const renderHotelFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cadena Hotelera</Label>
          <Popover open={hotelChainOpen} onOpenChange={setHotelChainOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={hotelChainOpen}
                className="w-full justify-between rounded-xl font-normal"
              >
                {mergedHotelChains.find(c => c.value === formData.hotel_chain)?.label || "Seleccionar cadena"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Buscar cadena..." />
                <CommandList>
                  <CommandEmpty>No se encontró.</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-y-auto">
                    {mergedHotelChains.map((chain) => (
                      <CommandItem
                        key={chain.value}
                        value={chain.label}
                        onSelect={() => {
                          handleChainChange(chain.value);
                          if (chain.value !== 'otro') {
                            updateField('hotel_chain_other', '');
                          }
                          setHotelChainOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.hotel_chain === chain.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {chain.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {formData.hotel_chain === 'otro' && (
            <Input
              value={formData.hotel_chain_other || ''}
              onChange={(e) => updateField('hotel_chain_other', e.target.value)}
              className="rounded-xl mt-2"
              placeholder="Especificar cadena hotelera"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>Sub-marca / Colección</Label>
          <Popover open={hotelBrandOpen} onOpenChange={setHotelBrandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={hotelBrandOpen}
                className="w-full justify-between rounded-xl font-normal"
                disabled={!formData.hotel_chain}
              >
                {availableBrands.find(b => b.value === formData.hotel_brand)?.label || (formData.hotel_chain ? "Seleccionar sub-marca" : "Primero selecciona cadena")}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Buscar sub-marca..." />
                <CommandList>
                  <CommandEmpty>No se encontró.</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-y-auto">
                    {availableBrands.map((brand) => (
                      <CommandItem
                        key={brand.value}
                        value={brand.label}
                        onSelect={() => {
                          updateField('hotel_brand', brand.value);
                          if (brand.value !== 'otro') {
                            updateField('hotel_brand_other', '');
                          }
                          setHotelBrandOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.hotel_brand === brand.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {brand.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {formData.hotel_brand === 'otro' && (
            <Input
              value={formData.hotel_brand_other || ''}
              onChange={(e) => updateField('hotel_brand_other', e.target.value)}
              className="rounded-xl mt-2"
              placeholder="Especificar sub-marca"
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre del Hotel</Label>
          <Input
            value={formData.hotel_name || ''}
            onChange={(e) => updateField('hotel_name', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Ciudad</Label>
          <Input
            value={formData.hotel_city || ''}
            onChange={(e) => updateField('hotel_city', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Check-in</Label>
          <Input
            type="date"
            value={formData.check_in || ''}
            onChange={(e) => {
              const checkIn = e.target.value;
              updateField('check_in', checkIn);
              if (checkIn && formData.check_out) {
                const nights = differenceInDays(new Date(formData.check_out), new Date(checkIn));
                if (nights > 0) updateField('nights', nights);
              }
            }}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Check-out</Label>
          <Input
            type="date"
            value={formData.check_out || ''}
            onChange={(e) => {
              const checkOut = e.target.value;
              updateField('check_out', checkOut);
              if (formData.check_in && checkOut) {
                const nights = differenceInDays(new Date(checkOut), new Date(formData.check_in));
                if (nights > 0) updateField('nights', nights);
              }
            }}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Noches</Label>
          <Input
            type="number"
            value={formData.nights || ''}
            readOnly
            className="rounded-xl bg-stone-50"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo Habitación</Label>
          <Input
            value={formData.room_type || ''}
            onChange={(e) => updateField('room_type', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Num. Habitaciones</Label>
          <Input
            type="number"
            value={formData.num_rooms || ''}
            onChange={(e) => updateField('num_rooms', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={formData.meal_plan || ''} onValueChange={(v) => updateField('meal_plan', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEAL_PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.reservation_number || ''}
            onChange={(e) => updateField('reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: ABC123456"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const [airlineOpen, setAirlineOpen] = React.useState(false);
  const [hotelChainOpen, setHotelChainOpen] = React.useState(false);
  const [hotelBrandOpen, setHotelBrandOpen] = React.useState(false);

  const renderVueloFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aerolínea</Label>
          <Popover open={airlineOpen} onOpenChange={setAirlineOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={airlineOpen}
                className="w-full justify-between rounded-xl font-normal"
              >
                {formData.airline || "Seleccionar aerolínea"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Buscar aerolínea..." />
                <CommandList>
                  <CommandEmpty>No se encontró aerolínea.</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-y-auto">
                    {mergedAirlines.map((airline) => (
                      <CommandItem
                        key={airline}
                        value={airline}
                        onSelect={() => {
                          updateField('airline', airline);
                          if (airline !== 'Otro') {
                            updateField('airline_other', '');
                          }
                          setAirlineOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.airline === airline ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {airline}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Ruta (Origen → Destino)</Label>
          <Input
            value={formData.route || ''}
            onChange={(e) => updateField('route', e.target.value)}
            placeholder="MEX → CDG"
            className="rounded-xl"
          />
        </div>
      </div>
      {formData.airline === 'Otro' && (
        <div className="space-y-2">
          <Label>Especificar Aerolínea</Label>
          <Input
            value={formData.airline_other || ''}
            onChange={(e) => updateField('airline_other', e.target.value)}
            className="rounded-xl"
            placeholder="Nombre de la aerolínea"
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Número de Vuelo</Label>
          <Input
            value={formData.flight_number || ''}
            onChange={(e) => updateField('flight_number', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={formData.flight_date || ''}
            onChange={(e) => updateField('flight_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Clase</Label>
          <Input
            value={formData.flight_class || ''}
            onChange={(e) => updateField('flight_class', e.target.value)}
            placeholder="Económica"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Hora Salida</Label>
          <Input
            type="time"
            value={formData.departure_time || ''}
            onChange={(e) => updateField('departure_time', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Hora Llegada</Label>
          <Input
            type="time"
            value={formData.arrival_time || ''}
            onChange={(e) => updateField('arrival_time', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Equipaje</Label>
          <Input
            value={formData.baggage_included || ''}
            onChange={(e) => updateField('baggage_included', e.target.value)}
            placeholder="23kg"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.flight_reservation_number || ''}
            onChange={(e) => updateField('flight_reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: ABC123"
          />
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <Input
            type="number"
            value={formData.passengers || ''}
            onChange={(e) => updateField('passengers', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const renderTrasladoFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={formData.transfer_type || 'privado'} onValueChange={(v) => updateField('transfer_type', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="privado">Privado</SelectItem>
              <SelectItem value="compartido">Compartido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Vehículo</Label>
          <Input
            value={formData.vehicle || ''}
            onChange={(e) => updateField('vehicle', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Origen</Label>
          <Input
            value={formData.transfer_origin || ''}
            onChange={(e) => updateField('transfer_origin', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Destino</Label>
          <Input
            value={formData.transfer_destination || ''}
            onChange={(e) => updateField('transfer_destination', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha y Hora</Label>
          <Input
            type="datetime-local"
            value={formData.transfer_datetime || ''}
            onChange={(e) => updateField('transfer_datetime', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <Input
            type="number"
            value={formData.transfer_passengers || ''}
            onChange={(e) => updateField('transfer_passengers', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const renderTourFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre del Tour</Label>
          <Input
            value={formData.tour_name || ''}
            onChange={(e) => updateField('tour_name', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Ciudad</Label>
          <Input
            value={formData.tour_city || ''}
            onChange={(e) => updateField('tour_city', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={formData.tour_date || ''}
            onChange={(e) => updateField('tour_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Duración</Label>
          <Input
            value={formData.tour_duration || ''}
            onChange={(e) => updateField('tour_duration', e.target.value)}
            placeholder="4 horas"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Incluye</Label>
        <Textarea
          value={formData.tour_includes || ''}
          onChange={(e) => updateField('tour_includes', e.target.value)}
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Personas</Label>
          <Input
            type="number"
            value={formData.tour_people || ''}
            onChange={(e) => updateField('tour_people', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.tour_reservation_number || ''}
            onChange={(e) => updateField('tour_reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: TOUR123"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const [cruiseLineOpen, setCruiseLineOpen] = React.useState(false);

  const renderCruceroFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Línea de Crucero</Label>
          <Popover open={cruiseLineOpen} onOpenChange={setCruiseLineOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={cruiseLineOpen}
                className="w-full justify-between rounded-xl font-normal"
              >
                {mergedCruiseLines.find(c => c.value === formData.cruise_line)?.label || "Seleccionar línea"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Buscar línea de crucero..." />
                <CommandList>
                  <CommandEmpty>No se encontró.</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-y-auto">
                    {mergedCruiseLines.map((line) => (
                      <CommandItem
                        key={line.value}
                        value={line.label}
                        onSelect={() => {
                          updateField('cruise_line', line.value);
                          setCruiseLineOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.cruise_line === line.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {line.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Nombre del Barco</Label>
          <Input
            value={formData.cruise_ship || ''}
            onChange={(e) => updateField('cruise_ship', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: Symphony of the Seas"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Itinerario</Label>
        <Input
          value={formData.cruise_itinerary || ''}
          onChange={(e) => updateField('cruise_itinerary', e.target.value)}
          className="rounded-xl"
          placeholder="Ej: Caribe Oriental - 7 noches"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Puerto de Salida</Label>
          <Input
            value={formData.cruise_departure_port || ''}
            onChange={(e) => updateField('cruise_departure_port', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: Miami, FL"
          />
        </div>
        <div className="space-y-2">
          <Label>Puerto de Llegada</Label>
          <Input
            value={formData.cruise_arrival_port || ''}
            onChange={(e) => updateField('cruise_arrival_port', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: Miami, FL"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Fecha Salida</Label>
          <Input
            type="date"
            value={formData.cruise_departure_date || ''}
            onChange={(e) => {
              const depDate = e.target.value;
              updateField('cruise_departure_date', depDate);
              if (depDate && formData.cruise_arrival_date) {
                const nights = differenceInDays(new Date(formData.cruise_arrival_date), new Date(depDate));
                if (nights > 0) updateField('cruise_nights', nights);
              }
            }}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha Llegada</Label>
          <Input
            type="date"
            value={formData.cruise_arrival_date || ''}
            onChange={(e) => {
              const arrDate = e.target.value;
              updateField('cruise_arrival_date', arrDate);
              if (formData.cruise_departure_date && arrDate) {
                const nights = differenceInDays(new Date(arrDate), new Date(formData.cruise_departure_date));
                if (nights > 0) updateField('cruise_nights', nights);
              }
            }}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Noches</Label>
          <Input
            type="number"
            value={formData.cruise_nights || ''}
            readOnly
            className="rounded-xl bg-stone-50"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Cabina</Label>
          <Select value={formData.cruise_cabin_type || ''} onValueChange={(v) => updateField('cruise_cabin_type', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {CABIN_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Número de Cabina</Label>
          <Input
            value={formData.cruise_cabin_number || ''}
            onChange={(e) => updateField('cruise_cabin_number', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <Input
            type="number"
            value={formData.cruise_passengers || ''}
            onChange={(e) => updateField('cruise_passengers', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.cruise_reservation_number || ''}
            onChange={(e) => updateField('cruise_reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: CRU123456"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const renderDmcFields = () => (
    <>
      <div className="space-y-2">
        <Label>Nombre del DMC</Label>
        <Input
          value={formData.dmc_name || ''}
          onChange={(e) => updateField('dmc_name', e.target.value)}
          className="rounded-xl"
          placeholder="Ej: Amstar DMC"
        />
      </div>
      <div className="space-y-2">
        <Label>Servicios Incluidos</Label>
        <Textarea
          value={formData.dmc_services || ''}
          onChange={(e) => updateField('dmc_services', e.target.value)}
          className="rounded-xl resize-none"
          rows={3}
          placeholder="Describe los servicios incluidos..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ciudad/Destino</Label>
          <Input
            value={formData.dmc_destination || ''}
            onChange={(e) => updateField('dmc_destination', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={formData.dmc_date || ''}
            onChange={(e) => updateField('dmc_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.dmc_reservation_number || ''}
            onChange={(e) => updateField('dmc_reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: DMC123456"
          />
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <Input
            type="number"
            value={formData.dmc_passengers || ''}
            onChange={(e) => updateField('dmc_passengers', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const renderTrenFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ruta (Origen → Destino)</Label>
          <Input
            value={formData.train_route || ''}
            onChange={(e) => updateField('train_route', e.target.value)}
            placeholder="París → Amsterdam"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Operador del Tren</Label>
          <Input
            value={formData.train_operator || ''}
            onChange={(e) => updateField('train_operator', e.target.value)}
            placeholder="Ej: Eurostar, TGV, Renfe"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Número de Tren</Label>
          <Input
            value={formData.train_number || ''}
            onChange={(e) => updateField('train_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: 9012"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={formData.train_date || ''}
            onChange={(e) => updateField('train_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Clase</Label>
          <Input
            value={formData.train_class || ''}
            onChange={(e) => updateField('train_class', e.target.value)}
            placeholder="Primera, Segunda"
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Hora Salida</Label>
          <Input
            type="time"
            value={formData.train_departure_time || ''}
            onChange={(e) => updateField('train_departure_time', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Hora Llegada</Label>
          <Input
            type="time"
            value={formData.train_arrival_time || ''}
            onChange={(e) => updateField('train_arrival_time', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <Input
            type="number"
            value={formData.train_passengers || ''}
            onChange={(e) => updateField('train_passengers', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
            className="rounded-xl"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Reservación</Label>
          <Input
            value={formData.train_reservation_number || ''}
            onChange={(e) => updateField('train_reservation_number', e.target.value)}
            className="rounded-xl"
            placeholder="Ej: TRAIN123456"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  const renderOtroFields = () => (
    <>
      <div className="space-y-2">
        <Label>Nombre del Servicio</Label>
        <Input
          value={formData.other_name || ''}
          onChange={(e) => updateField('other_name', e.target.value)}
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label>Descripción</Label>
        <Textarea
          value={formData.other_description || ''}
          onChange={(e) => updateField('other_description', e.target.value)}
          className="rounded-xl resize-none"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input
          type="date"
          value={formData.other_date || ''}
          onChange={(e) => updateField('other_date', e.target.value)}
          className="rounded-xl"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado de Reservación</Label>
          <Select value={formData.reservation_status || 'reservado'} onValueChange={(v) => updateField('reservation_status', v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reservado">Reservado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha Vencimiento de Pago</Label>
          <Input
            type="date"
            value={formData.payment_due_date || ''}
            onChange={(e) => updateField('payment_due_date', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
            {service ? 'Editar Servicio' : 'Nuevo Servicio'}
          </DialogTitle>
        </DialogHeader>

        {/* Autollenar con AI desde foto o PDF */}
        <label
          className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed cursor-pointer transition-colors ${aiLoading ? 'opacity-70 pointer-events-none' : 'hover:bg-stone-50'}`}
          style={{ borderColor: 'rgba(201,168,76,0.6)', background: 'rgba(201,168,76,0.06)' }}
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleAIExtract}
            disabled={aiLoading}
          />
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #C9A84C, #DFC078)' }}>
            {aiLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Sparkles className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800">
              {aiLoading ? 'Analizando archivo…' : 'Autollenar con AI'}
            </p>
            <p className="text-xs text-stone-500">
              Sube una foto o PDF (confirmación, voucher, factura) y completamos los campos por ti.
            </p>
          </div>
          {!aiLoading && <Upload className="w-4 h-4 text-stone-400 flex-shrink-0" />}
        </label>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Service Type */}
          <div className="space-y-2">
            <Label>Tipo de Servicio *</Label>
            <Select value={formData.service_type} onValueChange={(v) => updateField('service_type', v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {formData.service_type === 'vuelo' && (
              <p className="text-xs text-stone-500 italic">
                Comprado en YTC = $5 USD más por persona
              </p>
            )}
          </div>

          {/* Dynamic Fields */}
          {formData.service_type === 'hotel' && renderHotelFields()}
          {formData.service_type === 'vuelo' && renderVueloFields()}
          {formData.service_type === 'traslado' && renderTrasladoFields()}
          {formData.service_type === 'tour' && renderTourFields()}
          {formData.service_type === 'crucero' && renderCruceroFields()}
          {formData.service_type === 'tren' && renderTrenFields()}
          {formData.service_type === 'dmc' && renderDmcFields()}
          {formData.service_type === 'otro' && renderOtroFields()}

          {/* Common Fields */}
          <div className="border-t border-stone-200 pt-5 space-y-4">
            {/* Local Currency Section */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm text-stone-800">Cotización en Moneda Local</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select 
                    value={formData.local_currency || 'USD'} 
                    onValueChange={handleCurrencyChange}
                    disabled={convertingCurrency}
                  >
                    <SelectTrigger className="rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto en {formData.local_currency || 'USD'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.local_amount || ''}
                    onChange={(e) => handleLocalAmountChange(parseFloat(e.target.value) || 0)}
                    className="rounded-xl"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Precio Total (USD) {convertingCurrency && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.total_price || ''}
                      onChange={(e) => updateField('total_price', parseFloat(e.target.value) || 0)}
                      className="rounded-xl bg-white"
                      placeholder="0.00"
                    />
                    {formData.local_currency !== 'USD' && formData.local_amount > 0 && (
                      <Button
                        type="button"
                        onClick={handleConvertToUSD}
                        disabled={convertingCurrency}
                        className="rounded-xl whitespace-nowrap"
                        style={{ backgroundColor: '#2E442A' }}
                      >
                        {convertingCurrency ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convertir'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {formData.local_currency !== 'USD' && (
                <p className="text-xs text-stone-500">
                  Al convertir se aplica un <span className="font-medium">+1% de protección</span> de tipo de cambio. Si la conversión automática falla, escribe el Precio Total (USD) a mano.
                </p>
              )}
              {formData.quote_exchange_rate && formData.quote_date && (
                <div className="text-xs text-stone-600 bg-white rounded-lg p-2">
                  <p>Tipo de cambio: <span className="font-semibold">1 {formData.local_currency} = ${formData.quote_exchange_rate?.toFixed(4)} USD</span></p>
                  <p>Fecha de cotización: <span className="font-semibold">{formatDate(formData.quote_date, 'd MMM yyyy', { locale: es })}</span></p>
                  <p className="text-blue-600">Factor de protección 1.01 aplicado</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Pago</Label>
                <Select 
                  value={formData.payment_type || 'bruto'} 
                  onValueChange={(v) => updateField('payment_type', v)}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPE.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.payment_type === 'neto' && (
                  <p className="text-xs text-amber-600 mt-1">
                    ℹ️ Comisión neta = pertenece a Nomad
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Comisión (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.commission || ''}
                  onChange={(e) => updateField('commission', parseFloat(e.target.value) || 0)}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Pago Comisión</Label>
                <Input
                  type="date"
                  value={formData.commission_payment_date || ''}
                  onChange={(e) => updateField('commission_payment_date', e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className={`grid gap-4 ${formData.service_type === 'hotel' || formData.service_type === 'vuelo' || formData.service_type === 'crucero' || formData.service_type === 'tren' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-2">
                <Label>Agencia (IATA)</Label>
                <Select
                  value={formData.booked_by || 'montecito'}
                  onValueChange={(v) => {
                    updateField('booked_by', v);
                    // Auto-select consolidator for flights
                    if (formData.service_type === 'vuelo') {
                      if (v === 'montecito') {
                        updateField('flight_consolidator', 'ytc');
                      } else {
                        updateField('flight_consolidator', '');
                      }
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOOKED_BY.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formData.service_type === 'hotel' && (
                <div className="space-y-2">
                  <Label>Reservado por</Label>
                  <Select value={formData.reserved_by || ''} onValueChange={(v) => updateField('reserved_by', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {mergedReservedBy.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.service_type === 'vuelo' && (
                <div className="space-y-2">
                  <Label>Consolidador</Label>
                  <Select 
                    value={formData.flight_consolidator || ''} 
                    onValueChange={(v) => updateField('flight_consolidator', v)}
                    disabled={formData.booked_by === 'montecito'}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {(mergedFlightConsolidators[formData.booked_by] || []).map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ytcFee > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 +${ytcFee.toFixed(2)} fee YTC ({formData.passengers}p × $5) — se suma automáticamente al guardar
                    </p>
                  )}
                </div>
              )}
              {formData.service_type === 'crucero' && (
                <div className="space-y-2">
                  <Label>Proveedor de Crucero</Label>
                  <Select value={formData.cruise_provider || ''} onValueChange={(v) => updateField('cruise_provider', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {mergedCruiseProviders.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.service_type === 'tren' && (
                <div className="space-y-2">
                  <Label>Proveedor de Tren</Label>
                  <Select value={formData.train_provider || ''} onValueChange={(v) => updateField('train_provider', v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {mergedTrainProviders.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="rounded-xl text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {service ? 'Actualizar' : 'Agregar Servicio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}