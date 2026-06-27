import { useState, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { updateSoldTripTotalsFromServices } from '@/components/utils/soldTripRecalculations';
import { toast } from 'sonner';
import {
  Loader2, Search, DollarSign, Users, Calendar, ArrowUpDown, Check, Undo2,
  ChevronDown, ChevronUp, FileText, Save, AlertTriangle, Eye,
  Hotel, Plane, Car, Compass, Ship, Train, Briefcase, Package,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServiceDropdownOptions } from '@/hooks/useServiceDropdownOptions';
import { getSupplierCostToPay } from '@/components/utils/serviceCost';
import AgentCommissionInvoice from '@/components/commissions/AgentCommissionInvoice';

// ---- Misma lógica de cálculo y etiquetas que "Mis Comisiones" (fuente única) ----
const AGENT_RATE = 0.5;
const splitFor = (service) => {
  const bookedBy = service.booked_by || service.metadata?.booked_by;
  const commission = service.commission || 0;
  const agent = commission * AGENT_RATE;
  if (bookedBy === 'montecito') {
    return { agent, nomad: commission * 0.35, montecito: commission * 0.15, bookedBy };
  }
  return { agent, nomad: commission * 0.5, montecito: 0, bookedBy };
};

const money = (n) => `$${Math.round(n).toLocaleString()}`;

// ---- Opciones editables de IATA y Canal (espejo de ServiceForm) ----
const IATA_OPTIONS = [
  { value: 'iata_nomad', label: 'Nomad' },
  { value: 'montecito', label: 'Montecito' },
];

const FLIGHT_CONSOLIDATOR_OPTIONS = {
  montecito: [{ value: 'ytc', label: 'YTC' }],
  iata_nomad: [
    { value: 'directo', label: 'Directo' },
    { value: 'ez_travel', label: 'EZ Travel' },
    { value: 'lozano_travel', label: 'Lozano Travel' },
    { value: 'consofly', label: 'Consofly' },
  ],
};
const RESERVED_BY_OPTIONS = [
  { value: 'virtuoso', label: 'Virtuoso' },
  { value: 'preferred_partner', label: 'Preferred Partner' },
  { value: 'tbo', label: 'TBO' },
  { value: 'expedia_taap', label: 'Expedia TAAP' },
  { value: 'ratehawk', label: 'RateHawk' },
  { value: 'tablet_hotels', label: 'Tablet Hotels' },
  { value: 'dmc', label: 'DMC' },
  { value: 'otro', label: 'Otro' },
];
const CRUISE_PROVIDER_OPTIONS = [
  { value: 'creative_travel', label: 'Creative Travel' },
  { value: 'directo', label: 'Directo' },
  { value: 'international_cruises', label: 'International Cruises' },
  { value: 'cruceros_57', label: 'Cruceros 57' },
  { value: 'pema', label: 'PeMA' },
];
const TRAIN_PROVIDER_OPTIONS = [
  { value: 'rail_europe', label: 'Rail Europe' },
  { value: 'omio', label: 'Omio' },
  { value: 'klook', label: 'Klook' },
];

// Campo donde se guarda el "canal" según el tipo de servicio.
const CHANNEL_FIELD_BY_TYPE = {
  hotel: 'reserved_by', vuelo: 'flight_consolidator', crucero: 'cruise_provider', tren: 'train_provider',
};
const channelFieldFor = (service) => CHANNEL_FIELD_BY_TYPE[service.service_type] || null;
const channelValueOf = (service) => {
  const field = channelFieldFor(service);
  if (!field) return '';
  return service[field] || service.metadata?.[field] || '';
};
// 'nomad' es un alias histórico de 'iata_nomad'.
const normIata = (v) => (v === 'nomad' ? 'iata_nomad' : (v || 'iata_nomad'));
// Combina opciones estáticas con las personalizadas, deduplicando por value.
const mergeOpts = (staticList, custom = []) => {
  const seen = new Set(staticList.map(o => o.value));
  return [...staticList, ...custom.filter(o => o.value && !seen.has(o.value))];
};

const RESERVED_BY_LABELS = {
  virtuoso: 'Virtuoso', preferred_partner: 'Preferred Partner', tbo: 'TBO',
  expedia_taap: 'Expedia TAAP', ratehawk: 'RateHawk', tablet_hotels: 'Tablet Hotels', dmc: 'DMC', otro: 'Otro',
};
const CRUISE_PROVIDER_LABELS = {
  creative_travel: 'Creative Travel', directo: 'Directo', international_cruises: 'International Cruises',
  cruceros_57: 'Cruceros 57', pema: 'PeMA',
};
const CHANNEL_LABELS = {
  ...RESERVED_BY_LABELS, ...CRUISE_PROVIDER_LABELS,
  ytc: 'YTC', directo: 'Directo', ez_travel: 'EZ Travel', lozano_travel: 'Lozano Travel', consofly: 'Consofly',
};

const SERVICE_ICONS = { hotel: Hotel, vuelo: Plane, traslado: Car, tour: Compass, crucero: Ship, tren: Train, dmc: Briefcase, otro: Package };
const SERVICE_ICON_COLORS = {
  hotel: 'bg-rose-50 text-rose-500', vuelo: 'bg-sky-50 text-sky-500', traslado: 'bg-amber-50 text-amber-500',
  tour: 'bg-emerald-50 text-emerald-500', crucero: 'bg-cyan-50 text-cyan-500', tren: 'bg-pink-50 text-pink-500',
  dmc: 'bg-indigo-50 text-indigo-500', otro: 'bg-stone-100 text-stone-500',
};

const getServiceName = (service) => {
  const m = service.metadata || {};
  switch (service.service_type) {
    case 'hotel': return service.hotel_name || m.hotel_name || service.service_name || service.hotel_chain || m.hotel_chain || 'Hotel';
    case 'vuelo': return service.airline || m.airline || service.service_name || 'Vuelo';
    case 'traslado': {
      const o = service.transfer_origin || m.transfer_origin || '';
      const d = service.transfer_destination || m.transfer_destination || '';
      return (o || d) ? `${o} → ${d}` : (service.service_name || 'Traslado');
    }
    case 'tour': return service.tour_name || m.tour_name || service.service_name || 'Tour';
    case 'crucero': return service.cruise_ship || m.cruise_ship || service.cruise_line || m.cruise_line || service.service_name || 'Crucero';
    case 'tren': return `${service.train_operator || m.train_operator || 'Tren'} ${service.train_number || m.train_number || ''}`.trim() || service.service_name || 'Tren';
    case 'dmc': return service.dmc_name || m.dmc_name || service.service_name || 'DMC';
    case 'otro': return service.other_name || m.other_name || service.other_description || m.other_description || service.service_name || 'Servicio';
    default: return service.service_name || 'Servicio';
  }
};

// Campo de número de reservación según el tipo de servicio (con respaldo en metadata).
const RESERVATION_FIELD_BY_TYPE = {
  hotel: 'reservation_number',
  vuelo: 'flight_reservation_number',
  tour: 'tour_reservation_number',
  crucero: 'cruise_reservation_number',
  tren: 'train_reservation_number',
  dmc: 'dmc_reservation_number',
};
const getReservationNumber = (service) => {
  const m = service.metadata || {};
  const field = RESERVATION_FIELD_BY_TYPE[service.service_type];
  return (field && (service[field] || m[field]))
    || service.reservation_number || m.reservation_number
    || service.confirmation_number || m.confirmation_number
    || '';
};

const reservationStatusOf = (service) => service.reservation_status || service.metadata?.reservation_status;

// Estado del pago a proveedor de un servicio, comparando su costo contra los pagos enlazados.
const PAY_TONE_CLASSES = {
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-500',
  stone: 'bg-stone-100 text-stone-500',
};
const paymentStatusOf = (service, payInfo, tripIsEnded) => {
  const status = reservationStatusOf(service);
  if (status === 'cancelado') return null; // cancelado: no aplica
  const paid = payInfo?.paid || 0;
  const treatAsNeto = service.payment_type === 'neto' || !!payInfo?.hasNeto;
  const cost = getSupplierCostToPay(service, treatAsNeto);
  // La fuente de verdad es el pago a proveedor REGISTRADO, no el estado "pagado"
  // (un servicio puede marcarse "pagado" sin haber registrado su pago: eso es justo lo que hay que detectar).
  if (cost <= 0) return { key: 'sincosto', label: 'Sin costo', cost, paid, tone: 'stone' };
  if (cost - paid < 1) return { key: 'pagado', label: 'Pagado', cost, paid, tone: 'green' };
  if (paid > 0) return { key: 'parcial', label: 'Parcial', cost, paid, tone: 'amber' };
  return { key: 'sinpago', label: tripIsEnded ? 'Falta registrar pago' : 'Pendiente', cost, paid, tone: tripIsEnded ? 'red' : 'stone' };
};

// 5 etapas del ciclo de vida — idéntico a Mis Comisiones
const today = new Date();
today.setHours(0, 0, 0, 0);
const tripEnded = (trip) => {
  if (!trip) return false;
  const d = parseLocalDate(trip.end_date || trip.start_date);
  return d ? d < today : false;
};
const stageOf = (service, trip) => {
  if (service.paid_to_agent) return 'pagadas';
  if (service.commission_paid) return 'confirmadas';
  if (service.paid_to_agency) return 'pagadas_agencia';
  return tripEnded(trip) ? 'por_cobrar' : 'proximas';
};

const TABS = [
  { key: 'proximas', label: 'Próximas' },
  { key: 'por_cobrar', label: 'Por cobrar' },
  { key: 'pagadas_agencia', label: 'Por confirmar' },
  { key: 'confirmadas', label: 'Por pagar' },
  { key: 'pagadas', label: 'Pagadas' },
];

// Etiqueta y color por etapa, para la vista completa del viaje.
const STAGE_BADGE = {
  proximas: { label: 'Estimada', cls: 'bg-violet-50 text-violet-500' },
  por_cobrar: { label: 'Por cobrar', cls: 'bg-orange-50 text-orange-500' },
  pagadas_agencia: { label: 'Por confirmar', cls: 'bg-amber-50 text-amber-600' },
  confirmadas: { label: 'Por pagar', cls: 'bg-blue-50 text-blue-600' },
  pagadas: { label: 'Pagada', cls: 'bg-green-50 text-green-600' },
};

export default function InternalCommissions() {
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [activeTab, setActiveTab] = useState('pagadas_agencia');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [expanded, setExpanded] = useState(() => new Set());
  const [expandedTrips, setExpandedTrips] = useState(() => new Set());
  const [selected, setSelected] = useState([]); // service ids (solo en "Por pagar")
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [overviewTripId, setOverviewTripId] = useState(null); // viaje abierto en la vista completa
  const [edits, setEdits] = useState({}); // { [serviceId]: { booked_by?, channel? } } — IATA / Canal pendientes

  const queryClient = useQueryClient();

  const { data: customOptions = [] } = useServiceDropdownOptions();

  const { data: soldTrips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['soldTrips'],
    queryFn: () => supabaseAPI.entities.SoldTrip.list(),
  });
  const { data: tripServices = [], isLoading: loadingServices } = useQuery({
    queryKey: ['tripServices'],
    queryFn: () => supabaseAPI.entities.TripService.list(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => supabaseAPI.entities.User.list(),
  });

  const tripIdSet = useMemo(() => new Set(soldTrips.map(t => t.id)), [soldTrips]);
  const { data: clientPayments = [] } = useQuery({
    queryKey: ['allClientPayments', 'internal'],
    queryFn: async () => {
      const all = await supabaseAPI.entities.ClientPayment.list();
      return all.filter(p => tripIdSet.has(p.sold_trip_id));
    },
    enabled: soldTrips.length > 0,
  });
  const { data: supplierPayments = [] } = useQuery({
    queryKey: ['allSupplierPayments', 'internal'],
    queryFn: async () => {
      const all = await supabaseAPI.entities.SupplierPayment.list();
      return all.filter(p => tripIdSet.has(p.sold_trip_id));
    },
    enabled: soldTrips.length > 0,
  });

  const isLoading = loadingTrips || loadingServices;

  const tripsMap = useMemo(() => soldTrips.reduce((a, t) => { a[t.id] = t; return a; }, {}), [soldTrips]);
  const usersByEmail = useMemo(() => users.reduce((a, u) => { a[(u.email || '').toLowerCase()] = u; return a; }, {}), [users]);

  // Opciones de Canal: estáticas + personalizadas (ServiceDropdownOption), agrupadas por categoría.
  const customByCat = useMemo(() => {
    const m = {};
    customOptions.filter(o => o.is_active).forEach(o => {
      if (!m[o.category]) m[o.category] = [];
      m[o.category].push({ value: o.value, label: o.label });
    });
    return m;
  }, [customOptions]);
  const mergedReservedBy = useMemo(() => mergeOpts(RESERVED_BY_OPTIONS, customByCat.hotel_reserved_by), [customByCat]);
  const mergedCruiseProviders = useMemo(() => mergeOpts(CRUISE_PROVIDER_OPTIONS, customByCat.cruise_provider), [customByCat]);
  const mergedTrainProviders = useMemo(() => mergeOpts(TRAIN_PROVIDER_OPTIONS, customByCat.train_provider), [customByCat]);
  const mergedConsolidators = useMemo(() => ({
    montecito: FLIGHT_CONSOLIDATOR_OPTIONS.montecito,
    iata_nomad: mergeOpts(FLIGHT_CONSOLIDATOR_OPTIONS.iata_nomad, customByCat.flight_consolidator_nomad),
  }), [customByCat]);

  const channelOptionsFor = (service, bookedBy) => {
    switch (service.service_type) {
      case 'hotel': return mergedReservedBy;
      case 'vuelo': return mergedConsolidators[normIata(bookedBy)] || [];
      case 'crucero': return mergedCruiseProviders;
      case 'tren': return mergedTrainProviders;
      default: return [];
    }
  };

  // Valores efectivos (pendientes si los hay, si no los guardados) y estado "sucio".
  const effBookedBy = (s) => normIata(edits[s.id]?.booked_by ?? (s.booked_by || s.metadata?.booked_by));
  const effChannel = (s) => edits[s.id]?.channel ?? channelValueOf(s);
  const isRowDirty = (s) => {
    if (!edits[s.id]) return false;
    const curIata = normIata(s.booked_by || s.metadata?.booked_by);
    const channelChanged = channelFieldFor(s) && effChannel(s) !== channelValueOf(s);
    return effBookedBy(s) !== curIata || channelChanged;
  };

  const changeIata = (s, value) => setEdits(prev => {
    const cur = prev[s.id] || {};
    const next = { ...cur, booked_by: value };
    // Espejo de ServiceForm: en vuelos, Montecito usa YTC y al salir de Montecito se limpia.
    if (s.service_type === 'vuelo') {
      if (value === 'montecito') next.channel = 'ytc';
      else if ((cur.channel ?? channelValueOf(s)) === 'ytc') next.channel = '';
    }
    return { ...prev, [s.id]: next };
  });
  const changeChannel = (s, value) =>
    setEdits(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || {}), channel: value } }));
  const cancelRowEdits = (id) => setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });

  // Guardar IATA / Canal en el servicio original (columna + espejo en metadata para consistencia).
  const saveRowEdits = (s) => {
    const field = channelFieldFor(s);
    const booked_by = effBookedBy(s);
    let channel = field ? effChannel(s) : undefined;
    if (s.service_type === 'vuelo' && booked_by === 'montecito') channel = 'ytc';

    const meta = { ...(s.metadata || {}), booked_by };
    const data = { booked_by };
    if (field) {
      const val = channel || null;
      data[field] = val;
      meta[field] = val;
    }
    data.metadata = meta;

    updateServiceMutation.mutate({ id: s.id, data }, {
      onSuccess: () => { toast.success('Servicio actualizado'); cancelRowEdits(s.id); },
    });
  };

  // Pagos a proveedor enlazados a cada servicio (trip_service_id), para comparar con su costo.
  const supplierByService = useMemo(() => {
    const m = {};
    supplierPayments.forEach(p => {
      if (!p.trip_service_id) return;
      if (!m[p.trip_service_id]) m[p.trip_service_id] = { paid: 0, hasNeto: false };
      m[p.trip_service_id].paid += Number(p.amount) || 0;
      if (p.payment_type === 'neto') m[p.trip_service_id].hasNeto = true;
    });
    return m;
  }, [supplierPayments]);

  // Servicios agrupados por viaje (todo el folio), para el checklist de pagos.
  const servicesByTrip = useMemo(() => {
    const m = {};
    tripServices.forEach(s => {
      if (!m[s.sold_trip_id]) m[s.sold_trip_id] = [];
      m[s.sold_trip_id].push(s);
    });
    return m;
  }, [tripServices]);

  // Resumen financiero por viaje: comisión bruta/neta y saldo en cuenta.
  // Saldo = lo que el cliente pagó a Nomad − lo que Nomad pagó a proveedores.
  // Se EXCLUYE lo pagado con tarjeta del cliente (ese dinero no pasa por la cuenta de Nomad).
  const tripFinancials = useMemo(() => {
    const map = {};
    const ensure = (id) => (map[id] = map[id] || {
      gross: 0, net: 0, grossPaid: 0, netPaid: 0, agentPaid: 0,
      clientIn: 0, nomadOut: 0, services: 0,
    });
    tripServices.forEach(s => {
      const e = ensure(s.sold_trip_id);

      // Comisión bruta / neta (solo servicios con comisión)
      if (s.commission > 0) {
        e.services += 1;
        const isNet = s.payment_type === 'neto';
        if (isNet) e.net += s.commission;
        else e.gross += s.commission;
        // Comisiones ya liquidadas al agente: se descuentan de lo "pendiente".
        if (s.paid_to_agent) {
          if (isNet) e.netPaid += s.commission;
          else e.grossPaid += s.commission;
          e.agentPaid += splitFor(s).agent; // parte que realmente salió de la cuenta
        }
      }
    });
    clientPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return;
      ensure(p.sold_trip_id).clientIn += (p.amount_usd_fixed || p.amount || 0);
    });
    supplierPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return;
      ensure(p.sold_trip_id).nomadOut += (p.amount || 0);
    });
    Object.values(map).forEach(e => {
      e.saldo = e.clientIn - e.nomadOut;
      e.grossPending = e.gross - e.grossPaid;
      e.netPending = e.net - e.netPaid;
      // Comisión ya liquidada = comisión total de los servicios pagados al agente.
      // Incluye AMBAS mitades: lo pagado al agente y lo que Nomad (y Montecito) ya retuvo.
      e.settledCommission = e.grossPaid + e.netPaid;
      e.nomadKept = Math.max(0, e.settledCommission - e.agentPaid); // parte retenida por Nomad/Montecito
      // Disponible real = saldo menos TODA la comisión liquidada (agente + Nomad), no solo la del agente.
      e.disponible = e.saldo - e.settledCommission;
      // En teoría, lo que debe quedar en cuenta es la comisión neta aún pendiente.
      // Si sobra más que eso, es señal de pagos a proveedor sin registrar.
      e.unaccounted = e.disponible - e.netPending;
    });
    return map;
  }, [tripServices, clientPayments, supplierPayments]);

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripService.update(id, data),
    onSuccess: async (_, variables) => {
      const service = tripServices.find(s => s.id === variables.id);
      if (service?.sold_trip_id) await updateSoldTripTotalsFromServices(service.sold_trip_id, queryClient);
      queryClient.invalidateQueries({ queryKey: ['tripServices'] });
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
    },
    onError: () => toast.error('No se pudo actualizar la comisión'),
  });
  const setFlags = (service, data, okMsg) =>
    updateServiceMutation.mutate({ id: service.id, data }, { onSuccess: () => okMsg && toast.success(okMsg) });

  // Admin empuja a "pagado a agencia" si el agente no lo hizo
  const markPaidToAgency = (s) => setFlags(s, { paid_to_agency: true, paid_to_agency_date: s.paid_to_agency_date || new Date().toISOString().split('T')[0] });
  const undoPaidToAgency = (s) => setFlags(s, { paid_to_agency: false, commission_paid: false, paid_to_agent: false, paid_to_agency_date: null });
  // Admin confirma que la agencia recibió el dinero del proveedor
  const confirmReceipt = (s) => setFlags(s, { paid_to_agency: true, commission_paid: true }, 'Recepción confirmada');
  const undoConfirm = (s) => setFlags(s, { commission_paid: false, paid_to_agent: false });
  // Admin paga su parte al agente
  const payAgent = (s) => setFlags(s, { paid_to_agency: true, commission_paid: true, paid_to_agent: true }, 'Pagada al agente');
  const undoPay = (s) => setFlags(s, { paid_to_agent: false });

  // Corregir el tipo de comisión (neto / bruto) servicio por servicio
  const setPaymentType = (s, value) => setFlags(
    s,
    { payment_type: value === 'sin' ? null : value },
    value === 'neto' ? 'Marcada como NETA' : value === 'bruto' ? 'Marcada como BRUTA' : 'Tipo quitado'
  );

  // ---- Filas derivadas de los servicios ----
  const rows = useMemo(() => {
    return tripServices
      .filter(s => (s.commission || 0) > 0)
      .map(s => {
        const trip = tripsMap[s.sold_trip_id];
        const agentEmail = (trip?.created_by || '').toLowerCase();
        const agentUser = usersByEmail[agentEmail];
        const split = splitFor(s);
        return {
          service: s,
          trip,
          agentEmail,
          agentName: agentUser?.full_name || trip?.created_by || 'Sin asignar',
          iata: s.booked_by || s.metadata?.booked_by || 'iata_nomad',
          refDate: s.commission_payment_date || trip?.end_date || trip?.start_date || null,
          stage: stageOf(s, trip),
          split,
        };
      });
  }, [tripServices, tripsMap, usersByEmail]);

  const uniqueAgents = useMemo(
    () => [...new Set(rows.map(r => r.agentName))].filter(Boolean).sort(),
    [rows]
  );

  const q = search.toLowerCase();
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (filterAgent !== 'all' && r.agentName !== filterAgent) return false;
      if (q) {
        const hay = `${r.agentName} ${r.trip?.client_name || ''} ${r.trip?.destination || ''} ${getServiceName(r.service)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom || dateTo) {
        const d = r.refDate ? parseLocalDate(r.refDate) : null;
        if (dateFrom && (!d || d < parseLocalDate(dateFrom))) return false;
        if (dateTo && (!d || d > parseLocalDate(dateTo))) return false;
      }
      return true;
    });
  }, [rows, filterAgent, q, dateFrom, dateTo]);

  // Buckets por etapa
  const buckets = useMemo(() => {
    const b = { proximas: [], por_cobrar: [], pagadas_agencia: [], confirmadas: [], pagadas: [] };
    filteredRows.forEach(r => b[r.stage]?.push(r));
    return b;
  }, [filteredRows]);

  const sumAgent = (list) => list.reduce((sum, r) => sum + r.split.agent, 0);
  const sumTotal = (list) => list.reduce((sum, r) => sum + (r.service.commission || 0), 0);

  // Agrupar la pestaña activa por agente
  const visibleRows = buckets[activeTab] || [];
  const groups = useMemo(() => {
    const byAgent = visibleRows.reduce((acc, r) => {
      (acc[r.agentName] = acc[r.agentName] || []).push(r);
      return acc;
    }, {});
    return Object.entries(byAgent)
      .map(([agent, list]) => ({ agent, list }))
      .sort((a, b) => sumAgent(b.list) - sumAgent(a.list));
  }, [visibleRows]);

  const sortedRows = (list) => [...list].sort((a, b) => {
    const da = a.refDate ? parseLocalDate(a.refDate) : new Date(0);
    const db = b.refDate ? parseLocalDate(b.refDate) : new Date(0);
    return sortOrder === 'asc' ? da - db : db - da;
  });

  const toggleAgent = (agent) => setExpanded(prev => {
    const n = new Set(prev); n.has(agent) ? n.delete(agent) : n.add(agent); return n;
  });
  const toggleTrip = (tripId) => setExpandedTrips(prev => {
    const n = new Set(prev); n.has(tripId) ? n.delete(tripId) : n.add(tripId); return n;
  });

  // Subagrupar las filas de un agente por viaje
  const tripSubgroups = (list) => Object.values(
    list.reduce((acc, r) => {
      const id = r.trip?.id || r.service.sold_trip_id;
      if (!acc[id]) acc[id] = { tripId: id, trip: r.trip, rows: [] };
      acc[id].rows.push(r);
      return acc;
    }, {})
  ).sort((a, b) => {
    const da = a.trip ? (parseLocalDate(a.trip.end_date || a.trip.start_date) || new Date(0)) : new Date(0);
    const db = b.trip ? (parseLocalDate(b.trip.end_date || b.trip.start_date) || new Date(0)) : new Date(0);
    return sortOrder === 'asc' ? da - db : db - da;
  });

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectedRows = visibleRows.filter(r => selected.includes(r.service.id));

  const paySelected = async () => {
    for (const r of selectedRows) {
      await updateServiceMutation.mutateAsync({
        id: r.service.id,
        data: { paid_to_agency: true, commission_paid: true, paid_to_agent: true },
      });
    }
    setSelected([]);
    setInvoiceOpen(false);
    toast.success('Comisiones pagadas al agente');
  };

  // Forma esperada por el modal de factura
  const invoiceCommissions = selectedRows.map(r => ({
    agent_name: r.agentName,
    sold_trip_name: r.trip ? `${r.trip.client_name} - ${r.trip.destination || ''}`.trim() : 'Viaje',
    service_provider: getServiceName(r.service),
    estimated_amount: r.service.commission || 0,
    agent_commission: r.split.agent,
    nomad_commission: r.split.nomad,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  const StatCard = ({ label, value, sub, valueClass = 'text-stone-800' }) => (
    <div className="bg-white rounded-xl p-4 border border-stone-100">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
    </div>
  );

  const renderRow = (r) => {
    const s = r.service;
    const Icon = SERVICE_ICONS[s.service_type] || Package;
    const iconColors = SERVICE_ICON_COLORS[s.service_type] || SERVICE_ICON_COLORS.otro;
    const resNumber = getReservationNumber(s);
    const channelField = channelFieldFor(s);
    const effIata = effBookedBy(s);
    const effChan = effChannel(s);
    const dirty = isRowDirty(s);
    const chOptions = channelOptionsFor(s, effIata);
    // Asegura que el valor actual aparezca aunque no esté en la lista estática.
    const chOptionsFull = (effChan && !chOptions.some(o => o.value === effChan))
      ? [...chOptions, { value: effChan, label: CHANNEL_LABELS[effChan] || effChan }]
      : chOptions;

    return (
      <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-t border-stone-100 bg-stone-50/40">
        {activeTab === 'confirmadas' ? (
          <span className="w-7 flex justify-center flex-shrink-0">
            <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} />
          </span>
        ) : <span className="w-7 flex-shrink-0" />}

        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-stone-800 truncate">{getServiceName(s)}</p>
          <p className="text-[11px] text-stone-400 truncate">
            {resNumber && <span className="font-medium text-stone-500">Res: {resNumber} · </span>}
            {r.trip ? `${r.trip.client_name}${r.trip.destination ? ' · ' + r.trip.destination : ''}` : 'Viaje'}
            {r.refDate ? ` · ${formatDate(r.refDate, 'd MMM yy', { locale: es })}` : ''}
          </p>
        </div>

        <div className="w-24 flex-shrink-0 hidden md:block" onClick={(e) => e.stopPropagation()}>
          <Select value={s.payment_type || 'sin'} onValueChange={(v) => setPaymentType(s, v)}>
            <SelectTrigger
              className={`h-6 px-2 rounded-md text-[10px] font-bold tracking-wider ${
                s.payment_type === 'neto'
                  ? 'border-green-200 bg-green-50 text-green-600'
                  : s.payment_type === 'bruto'
                    ? 'border-orange-200 bg-orange-50 text-orange-600'
                    : 'border-amber-200 bg-amber-50 text-amber-600'
              }`}
              title="Tipo de comisión"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="neto">NETO</SelectItem>
              <SelectItem value="bruto">BRUTO</SelectItem>
              <SelectItem value="sin">Sin tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-20 flex-shrink-0 hidden lg:block" onClick={(e) => e.stopPropagation()}>
          <Select value={effIata} onValueChange={(v) => changeIata(s, v)}>
            <SelectTrigger className="h-6 px-2 rounded-md text-[10px] font-medium border-stone-200 text-stone-600" title="Agencia (IATA)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IATA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-24 flex-shrink-0 hidden lg:block min-w-0" onClick={(e) => e.stopPropagation()}>
          {channelField ? (
            <Select value={effChan || ''} onValueChange={(v) => changeChannel(s, v)}>
              <SelectTrigger className="h-6 px-2 rounded-md text-[10px] border-stone-200 text-stone-600" title="Canal">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {chOptionsFull.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-stone-300">—</span>
          )}
        </div>

        <div className="w-14 flex-shrink-0 hidden lg:flex items-center justify-center gap-1">
          {dirty && (
            <>
              <button
                onClick={() => saveRowEdits(s)}
                disabled={updateServiceMutation.isPending}
                title="Guardar cambios"
                className="h-6 w-6 flex items-center justify-center rounded-md text-white"
                style={{ backgroundColor: '#2E442A' }}
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => cancelRowEdits(s.id)} title="Descartar" className="p-1 rounded text-stone-300 hover:text-stone-500">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="w-20 flex-shrink-0 text-right hidden sm:block">
          <span className="text-sm font-semibold text-stone-700">{money(s.commission || 0)}</span>
        </div>

        <div className="w-32 flex-shrink-0 text-right">
          <p className="text-sm font-bold text-stone-800">{money(r.split.agent)}</p>
          <p className="text-[10px] text-stone-400 leading-tight whitespace-nowrap">
            50% · Nomad {money(r.split.nomad)}{r.split.montecito > 0 && <> · <span className="text-amber-600">Mtcto {money(r.split.montecito)}</span></>}
          </p>
        </div>

        <div className="w-52 flex-shrink-0 flex justify-end">
          {r.stage === 'proximas' && (
            <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-violet-50 text-violet-500">ESTIMADA</span>
          )}
          {r.stage === 'por_cobrar' && (
            <Button variant="outline" size="sm" onClick={() => markPaidToAgency(s)} disabled={updateServiceMutation.isPending}
              className="h-7 rounded-lg text-xs border-stone-300 px-2 whitespace-nowrap">
              <Check className="w-3 h-3 mr-1" /> Pagado a agencia
            </Button>
          )}
          {r.stage === 'pagadas_agencia' && (
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => confirmReceipt(s)} disabled={updateServiceMutation.isPending}
                className="h-7 rounded-lg text-xs text-white px-2 whitespace-nowrap" style={{ backgroundColor: '#2E442A' }}>
                <Check className="w-3 h-3 mr-1" /> Confirmar recepción
              </Button>
              <button onClick={() => undoPaidToAgency(s)} title="Deshacer" className="p-1 rounded text-stone-300 hover:text-stone-500">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {r.stage === 'confirmadas' && (
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => payAgent(s)} disabled={updateServiceMutation.isPending}
                className="h-7 rounded-lg text-xs text-white px-2 whitespace-nowrap bg-blue-600 hover:bg-blue-700">
                <DollarSign className="w-3 h-3 mr-1" /> Pagar al agente
              </Button>
              <button onClick={() => undoConfirm(s)} title="Deshacer confirmación" className="p-1 rounded text-stone-300 hover:text-stone-500">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {r.stage === 'pagadas' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-green-50 text-green-600">PAGADA</span>
              <button onClick={() => undoPay(s)} title="Deshacer pago" className="p-1 rounded text-stone-300 hover:text-stone-500">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Comisiones Internas</h1>
          <p className="text-stone-400 text-sm">Confirma el pago de proveedores y paga su comisión a cada agente</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Agente, cliente o destino..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Por confirmar" value={money(sumAgent(buckets.pagadas_agencia))} sub={`${buckets.pagadas_agencia.length} · reportadas por agentes`} valueClass="text-amber-600" />
        <StatCard label="Por pagar a agentes" value={money(sumAgent(buckets.confirmadas))} sub={`${buckets.confirmadas.length} · confirmadas`} valueClass="text-blue-600" />
        <StatCard label="Pagadas a agentes" value={money(sumAgent(buckets.pagadas))} sub={`${buckets.pagadas.length} · 50% entregado`} valueClass="text-green-600" />
        <StatCard label="Por cobrar" value={money(sumAgent(buckets.por_cobrar))} sub={`${buckets.por_cobrar.length} · viajes terminados`} valueClass="text-orange-500" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {uniqueAgents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 rounded-xl" />
          <span className="text-stone-400">-</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 rounded-xl" />
        </div>
        <Button variant="outline" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="rounded-xl">
          <ArrowUpDown className="w-4 h-4 mr-2" />{sortOrder === 'asc' ? 'Más cercanas' : 'Más lejanas'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto">
        {TABS.map(tab => {
          const count = buckets[tab.key].length;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelected([]); }}
              className={`pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                active ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}>
              {tab.label}
              {count > 0 ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab.key === 'pagadas_agencia' ? 'bg-amber-100 text-amber-600'
                    : tab.key === 'confirmadas' ? 'bg-blue-100 text-blue-600' : 'bg-stone-100 text-stone-500'
                }`}>{count}</span>
              ) : <span className="text-stone-300">—</span>}
            </button>
          );
        })}
      </div>

      {/* Barra de selección (solo "Por pagar") */}
      {activeTab === 'confirmadas' && selectedRows.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-800">
            <strong>{selectedRows.length}</strong> seleccionada{selectedRows.length !== 1 ? 's' : ''} · A pagar: <strong>{money(sumAgent(selectedRows))}</strong>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)} className="rounded-lg">
              <FileText className="w-4 h-4 mr-1.5" /> Generar invoice
            </Button>
            <Button size="sm" onClick={paySelected} disabled={updateServiceMutation.isPending} className="text-white rounded-lg bg-blue-600 hover:bg-blue-700">
              Pagar seleccionadas
            </Button>
          </div>
        </div>
      )}

      {/* Lista agrupada por agente */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {/* Encabezado de columnas */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
          <span className="w-7 flex-shrink-0" />
          <span className="w-8 flex-shrink-0" />
          <span className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">Servicio · Viaje</span>
          <span className="w-24 flex-shrink-0 hidden md:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Tipo</span>
          <span className="w-20 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">IATA</span>
          <span className="w-24 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Canal</span>
          <span className="w-14 flex-shrink-0 hidden lg:block" />
          <span className="w-20 flex-shrink-0 hidden sm:block text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Comisión</span>
          <span className="w-32 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Agente (50%)</span>
          <span className="w-52 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Acción</span>
        </div>

        {groups.map(({ agent, list }) => {
          const isOpen = expanded.has(agent);
          return (
            <div key={agent} className="border-b border-stone-100 last:border-0">
              <button onClick={() => toggleAgent(agent)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left">
                <span className="w-7 flex justify-center text-stone-300">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2E442A15' }}>
                  <Users className="w-4 h-4" style={{ color: '#2E442A' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-800 truncate">{agent}</p>
                  <p className="text-xs text-stone-400">{list.length} comisión{list.length !== 1 ? 'es' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Comisión total</p>
                  <p className="text-sm font-bold text-stone-700">{money(sumTotal(list))}</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Parte agente</p>
                  <p className="text-sm font-bold" style={{ color: '#2E442A' }}>{money(sumAgent(list))}</p>
                </div>
              </button>
              {isOpen && tripSubgroups(list).map(({ tripId, trip, rows }) => {
                const tripOpen = expandedTrips.has(tripId);
                const tripTotal = sumTotal(rows);
                const refDate = trip?.end_date || trip?.start_date;
                const fin = tripFinancials[tripId] || {
                  gross: 0, net: 0, grossPaid: 0, netPaid: 0, agentPaid: 0,
                  clientIn: 0, nomadOut: 0, saldo: 0, services: 0,
                  grossPending: 0, netPending: 0, disponible: 0,
                  settledCommission: 0, nomadKept: 0, unaccounted: 0,
                };
                const matchesNet = Math.abs(fin.unaccounted) < 1;
                // ¿La tarjeta financiera abarca más servicios que los visibles en esta etapa?
                const moreThanShown = fin.services > rows.length;
                const tripIsEnded = tripEnded(trip);
                // Checklist de pagos: cada servicio del folio comparado con sus pagos a proveedor.
                const payChecklist = (servicesByTrip[tripId] || [])
                  .map(s => ({ s, st: paymentStatusOf(s, supplierByService[s.id], tripIsEnded) }))
                  .filter(x => x.st);
                const missingCount = payChecklist.filter(x => x.st.key === 'sinpago').length;
                const partialCount = payChecklist.filter(x => x.st.key === 'parcial').length;
                // Alerta solo en viajes terminados (donde los pagos ya deberían estar registrados).
                const hasPaymentGap = tripIsEnded && (missingCount > 0 || partialCount > 0);
                return (
                  <div key={tripId} className="border-t border-stone-100 bg-stone-50/30">
                    <div className="flex items-stretch">
                      <button onClick={() => toggleTrip(tripId)} className="flex-1 min-w-0 flex items-center gap-3 pl-10 pr-2 py-2.5 hover:bg-stone-100/60 transition-colors text-left">
                        <span className="w-5 flex justify-center text-stone-300">
                          {tripOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-700 truncate">
                            {trip ? `${trip.client_name} ${trip.destination || ''}`.trim() : 'Viaje'}
                            {trip?.trip_name ? ` — ${trip.trip_name}` : ''}
                          </p>
                          <p className="text-xs text-stone-400">
                            {rows.length} comisión{rows.length !== 1 ? 'es' : ''}{refDate ? ` · ${formatDate(refDate, 'yyyy-MM-dd')}` : ''}
                            {hasPaymentGap && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-red-500 font-semibold" title="Hay servicios del folio sin su pago a proveedor registrado">
                                <AlertTriangle className="w-3 h-3" />
                                {missingCount > 0 ? `${missingCount} sin pago` : `${partialCount} parcial`}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total</p>
                          <p className="text-sm font-bold text-stone-700">{money(tripTotal)}</p>
                        </div>
                        <div className="text-right w-24">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Parte agente</p>
                          <p className="text-sm font-bold" style={{ color: '#2E442A' }}>{money(sumAgent(rows))}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setOverviewTripId(tripId)}
                        title="Ver el viaje completo (todas las comisiones)"
                        className="px-3 flex items-center gap-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100/60 border-l border-stone-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-[11px] font-medium hidden sm:inline">Ver todo</span>
                      </button>
                    </div>

                    {tripOpen && sortedRows(rows).map(renderRow)}

                    {tripOpen && (
                      <div className="pl-12 pr-4 py-3 border-t border-stone-100 bg-white">
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            Resumen del viaje completo
                          </p>
                          <span className="text-[10px] text-stone-400">
                            · {fin.services} servicio{fin.services !== 1 ? 's' : ''} con comisión
                            {moreThanShown ? ` (incluye ${fin.services - rows.length} fuera de esta etapa)` : ''}
                          </span>
                        </div>

                        {/* Alerta: servicios del folio sin su pago a proveedor registrado */}
                        {hasPaymentGap && (
                          <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-tight text-red-700">
                              <p className="font-bold">Faltan pagos a proveedor por registrar</p>
                              <p className="text-red-600 mt-0.5">
                                {missingCount > 0 && `${missingCount} servicio(s) sin pago asociado`}
                                {missingCount > 0 && partialCount > 0 && ' y '}
                                {partialCount > 0 && `${partialCount} con pago parcial`}.
                                {' '}Revisa el detalle de abajo y registra los pagos faltantes antes de procesar las comisiones
                                {fin.unaccounted > 1 ? ` (sobran ${money(fin.unaccounted)} en el saldo sin justificar).` : '.'}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-stretch gap-2">
                          <div className="flex-1 min-w-[140px] rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Comisión bruta pendiente</p>
                            <p className="text-sm font-bold text-orange-600">{money(fin.grossPending)}</p>
                            {fin.grossPaid > 0 && (
                              <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                                de {money(fin.gross)} · pagado {money(fin.grossPaid)}
                              </p>
                            )}
                          </div>
                          <div className="flex-1 min-w-[140px] rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">Comisión neta pendiente</p>
                            <p className="text-sm font-bold text-green-700">{money(fin.netPending)}</p>
                            {fin.netPaid > 0 && (
                              <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                                de {money(fin.net)} · pagado {money(fin.netPaid)}
                              </p>
                            )}
                          </div>
                          <div className={`flex-1 min-w-[190px] rounded-lg border px-3 py-2 ${matchesNet ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Saldo en cuenta</p>
                              {matchesNet
                                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                : <span className="text-[10px] text-stone-400">vs neta pend. {money(fin.netPending)}</span>}
                            </div>
                            <p className={`text-sm font-bold ${fin.saldo < 0 ? 'text-red-600' : 'text-stone-800'}`}>{money(fin.saldo)}</p>
                            {fin.settledCommission > 0 && (
                              <div className="mt-1 pt-1 border-t border-stone-200/70">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Disponible</span>
                                  <span className={`text-xs font-bold ${fin.disponible < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(fin.disponible)}</span>
                                </div>
                                <p className="text-[10px] text-stone-400 leading-tight">
                                  − pagado a agentes {money(fin.agentPaid)} − retenido por Nomad {money(fin.nomadKept)}
                                </p>
                              </div>
                            )}
                            <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                              Cliente pagó {money(fin.clientIn)} − Nomad pagó {money(fin.nomadOut)}
                            </p>
                            {hasPaymentGap && fin.unaccounted > 1 && (
                              <p className="text-[10px] leading-tight mt-0.5 text-red-500 font-medium">
                                Debería quedar {money(fin.netPending)} (neta pendiente) · sobran {money(fin.unaccounted)} sin justificar
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Checklist de pagos por servicio (todo el folio) */}
                        {payChecklist.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-stone-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                              Pagos por servicio
                            </p>
                            <div className="space-y-1">
                              {payChecklist.map(({ s, st }) => {
                                const res = getReservationNumber(s);
                                return (
                                  <div key={s.id} className="flex items-center gap-2 text-[11px]">
                                    {st.tone === 'green'
                                      ? <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                      : <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${st.tone === 'red' ? 'text-red-500' : st.tone === 'amber' ? 'text-amber-500' : 'text-stone-300'}`} />}
                                    <span className="flex-1 min-w-0 truncate text-stone-600">
                                      {getServiceName(s)}
                                      {res && <span className="text-stone-400"> · Res: {res}</span>}
                                    </span>
                                    <span className="text-stone-400 whitespace-nowrap hidden sm:inline">
                                      {money(st.paid)} / {money(st.cost)}
                                    </span>
                                    <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${PAY_TONE_CLASSES[st.tone]}`}>
                                      {st.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="p-10 text-center text-stone-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-stone-200" />
            <p className="text-sm">No hay comisiones en esta etapa</p>
          </div>
        )}
      </div>

      {/* Modal de factura para el pago al agente */}
      <AgentCommissionInvoice
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        commissions={invoiceCommissions}
        onMarkAsPaid={paySelected}
      />

      {/* Vista completa del viaje: todas las comisiones (de todas las etapas) en una ventana */}
      {overviewTripId && (() => {
        const oTrip = tripsMap[overviewTripId];
        const oFin = tripFinancials[overviewTripId] || {
          gross: 0, net: 0, grossPaid: 0, netPaid: 0, agentPaid: 0, clientIn: 0, nomadOut: 0, services: 0,
          saldo: 0, grossPending: 0, netPending: 0, disponible: 0, settledCommission: 0, nomadKept: 0, unaccounted: 0,
        };
        const oEnded = tripEnded(oTrip);
        const oRows = rows
          .filter(r => (r.trip?.id || r.service.sold_trip_id) === overviewTripId)
          .sort((a, b) => {
            const da = a.refDate ? parseLocalDate(a.refDate) : new Date(0);
            const db = b.refDate ? parseLocalDate(b.refDate) : new Date(0);
            return da - db;
          });
        const oChecklist = (servicesByTrip[overviewTripId] || [])
          .map(s => ({ s, st: paymentStatusOf(s, supplierByService[s.id], oEnded) }))
          .filter(x => x.st);
        const oMissing = oChecklist.filter(x => x.st.key === 'sinpago').length;
        const oPartial = oChecklist.filter(x => x.st.key === 'parcial').length;
        const oGap = oEnded && (oMissing > 0 || oPartial > 0);
        const oAgent = oRows[0]?.agentName || 'Sin asignar';
        const oTotalComm = oRows.reduce((sum, r) => sum + (r.service.commission || 0), 0);
        const oAgentPart = oRows.reduce((sum, r) => sum + r.split.agent, 0);
        const oRefDate = oTrip?.end_date || oTrip?.start_date;

        return (
          <Dialog open onOpenChange={(o) => { if (!o) setOverviewTripId(null); }}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold pr-6" style={{ color: '#2E442A' }}>
                  {oTrip ? `${oTrip.client_name} ${oTrip.destination || ''}`.trim() : 'Viaje'}
                  {oTrip?.trip_name ? ` — ${oTrip.trip_name}` : ''}
                </DialogTitle>
              </DialogHeader>

              {/* Sub-encabezado */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 -mt-2">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {oAgent}</span>
                {oRefDate && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(oRefDate, 'd MMM yyyy', { locale: es })}</span>}
                <span>{oRows.length} comisión{oRows.length !== 1 ? 'es' : ''}</span>
                <span className="ml-auto">Comisión total <strong className="text-stone-700">{money(oTotalComm)}</strong> · Agente <strong style={{ color: '#2E442A' }}>{money(oAgentPart)}</strong></span>
              </div>

              {/* Alerta de pagos faltantes */}
              {oGap && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight text-red-700">
                    <p className="font-bold">Faltan pagos a proveedor por registrar</p>
                    <p className="text-red-600 mt-0.5">
                      {oMissing > 0 && `${oMissing} servicio(s) sin pago asociado`}
                      {oMissing > 0 && oPartial > 0 && ' y '}
                      {oPartial > 0 && `${oPartial} con pago parcial`}.
                      {oFin.unaccounted > 1 ? ` Sobran ${money(oFin.unaccounted)} en el saldo sin justificar.` : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Resumen financiero */}
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="flex-1 min-w-[130px] rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Bruta pendiente</p>
                  <p className="text-sm font-bold text-orange-600">{money(oFin.grossPending)}</p>
                  {oFin.grossPaid > 0 && <p className="text-[10px] text-stone-400">de {money(oFin.gross)} · pagado {money(oFin.grossPaid)}</p>}
                </div>
                <div className="flex-1 min-w-[130px] rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">Neta pendiente</p>
                  <p className="text-sm font-bold text-green-700">{money(oFin.netPending)}</p>
                  {oFin.netPaid > 0 && <p className="text-[10px] text-stone-400">de {money(oFin.net)} · pagado {money(oFin.netPaid)}</p>}
                </div>
                <div className="flex-1 min-w-[170px] rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Saldo en cuenta</p>
                  <p className={`text-sm font-bold ${oFin.saldo < 0 ? 'text-red-600' : 'text-stone-800'}`}>{money(oFin.saldo)}</p>
                  {oFin.settledCommission > 0 && (
                    <p className="text-[10px] text-stone-400">
                      Disponible <strong className={oFin.disponible < 0 ? 'text-red-600' : 'text-emerald-700'}>{money(oFin.disponible)}</strong>
                      {' '}(− agentes {money(oFin.agentPaid)} − Nomad {money(oFin.nomadKept)})
                    </p>
                  )}
                </div>
              </div>

              {/* Todas las comisiones del viaje */}
              <div className="rounded-xl border border-stone-100 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 py-2 bg-stone-50 border-b border-stone-100">
                  Comisiones del viaje
                </p>
                {oRows.length === 0 && <p className="px-3 py-4 text-xs text-stone-400 text-center">Sin comisiones registradas</p>}
                {oRows.map((r) => {
                  const s = r.service;
                  const Icon = SERVICE_ICONS[s.service_type] || Package;
                  const badge = STAGE_BADGE[r.stage] || { label: r.stage, cls: 'bg-stone-100 text-stone-500' };
                  const res = getReservationNumber(s);
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 border-t border-stone-100 first:border-t-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${SERVICE_ICON_COLORS[s.service_type] || SERVICE_ICON_COLORS.otro}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 truncate">{getServiceName(s)}</p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {res && `Res: ${res} · `}{s.payment_type ? s.payment_type.toUpperCase() : 'sin tipo'}
                          {r.refDate ? ` · ${formatDate(r.refDate, 'd MMM yy', { locale: es })}` : ''}
                        </p>
                      </div>
                      <div className="text-right w-16 hidden sm:block">
                        <p className="text-[9px] text-stone-400">Comisión</p>
                        <p className="text-xs font-semibold text-stone-600">{money(s.commission || 0)}</p>
                      </div>
                      <div className="text-right w-16">
                        <p className="text-[9px] text-stone-400">Agente</p>
                        <p className="text-xs font-bold" style={{ color: '#2E442A' }}>{money(r.split.agent)}</p>
                      </div>
                      <span className={`flex-shrink-0 w-24 text-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-1 rounded ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Checklist de pagos por servicio */}
              {oChecklist.length > 0 && (
                <div className="rounded-xl border border-stone-100 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 py-2 bg-stone-50 border-b border-stone-100">
                    Pagos por servicio (todo el folio)
                  </p>
                  <div className="px-3 py-2 space-y-1">
                    {oChecklist.map(({ s, st }) => {
                      const res = getReservationNumber(s);
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-[11px]">
                          {st.tone === 'green'
                            ? <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                            : <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${st.tone === 'red' ? 'text-red-500' : st.tone === 'amber' ? 'text-amber-500' : 'text-stone-300'}`} />}
                          <span className="flex-1 min-w-0 truncate text-stone-600">
                            {getServiceName(s)}{res && <span className="text-stone-400"> · Res: {res}</span>}
                          </span>
                          <span className="text-stone-400 whitespace-nowrap hidden sm:inline">{money(st.paid)} / {money(st.cost)}</span>
                          <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${PAY_TONE_CLASSES[st.tone]}`}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
