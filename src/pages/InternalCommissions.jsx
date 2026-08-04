import { useState, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { updateSoldTripTotalsFromServices } from '@/components/utils/soldTripRecalculations';
import { toast } from 'sonner';
import {
  Loader2, Search, DollarSign, Users, Calendar, ArrowUpDown, Check, Undo2,
  ChevronDown, ChevronUp, FileText, ArrowRightLeft, AlertTriangle, Wallet,
  Hotel, Plane, Car, Compass, Ship, Train, Briefcase, Package,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AgentCommissionInvoice from '@/components/commissions/AgentCommissionInvoice';
// ---- Misma lógica de cálculo y etiquetas que "Mis Comisiones" (fuente única) ----
import { splitFor, agentPct, isNetService, transferVerdict } from '@/components/utils/commissions';

const money = (n) => `$${Math.round(n).toLocaleString()}`;

const IATA_LABELS = { montecito: 'Montecito', iata_nomad: 'IATA Nomad', nomad: 'IATA Nomad' };

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

const getChannel = (service) => {
  const m = service.metadata || {};
  const raw = service.reserved_by || m.reserved_by
    || service.flight_consolidator || m.flight_consolidator
    || service.cruise_provider || m.cruise_provider
    || service.train_provider || m.train_provider;
  if (!raw) return '—';
  return CHANNEL_LABELS[raw] || raw;
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
  { key: 'cierre', label: 'Cierre mensual' },
  { key: 'proximas', label: 'Próximas' },
  { key: 'por_cobrar', label: 'Por cobrar' },
  { key: 'pagadas_agencia', label: 'Por confirmar' },
  { key: 'confirmadas', label: 'Por pagar' },
  { key: 'pagadas', label: 'Pagadas' },
];

export default function InternalCommissions() {
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [activeTab, setActiveTab] = useState('cierre');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [expanded, setExpanded] = useState(() => new Set());
  const [expandedTrips, setExpandedTrips] = useState(() => new Set());
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [expandedCierre, setExpandedCierre] = useState(() => new Set());
  const [selected, setSelected] = useState([]); // service ids (solo en "Por pagar")
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const queryClient = useQueryClient();

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

  // Resumen financiero por viaje: comisión bruta/neta y saldo en cuenta.
  // Saldo = lo que el cliente pagó a Nomad − lo que Nomad pagó a proveedores.
  // Se EXCLUYE lo pagado con tarjeta del cliente (ese dinero no pasa por la cuenta de Nomad).
  const tripFinancials = useMemo(() => {
    const map = {};
    const ensure = (id) => (map[id] = map[id] || { gross: 0, net: 0, clientIn: 0, nomadOut: 0 });
    tripServices.forEach(s => {
      if (!(s.commission > 0)) return;
      const e = ensure(s.sold_trip_id);
      if (s.payment_type === 'neto') e.net += s.commission;
      else e.gross += s.commission;
    });
    clientPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return;
      ensure(p.sold_trip_id).clientIn += (p.amount_usd_fixed || p.amount || 0);
    });
    supplierPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return;
      ensure(p.sold_trip_id).nomadOut += (p.amount || 0);
    });
    Object.values(map).forEach(e => { e.saldo = e.clientIn - e.nomadOut; });
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
  const undoPaidToAgency = (s) => setFlags(s, { paid_to_agency: false, commission_paid: false, paid_to_agent: false, paid_to_agency_date: null, paid_to_agent_date: null });
  // Admin confirma que la agencia recibió el dinero del proveedor
  const confirmReceipt = (s) => setFlags(s, { paid_to_agency: true, commission_paid: true }, 'Recepción confirmada');
  const undoConfirm = (s) => setFlags(s, { commission_paid: false, paid_to_agent: false, paid_to_agent_date: null });
  // Admin paga su parte al agente (registra la fecha de pago)
  const payAgent = (s) => setFlags(s, {
    paid_to_agency: true,
    commission_paid: true,
    paid_to_agent: true,
    paid_to_agent_date: s.paid_to_agent_date || new Date().toISOString().split('T')[0],
  }, 'Pagada al agente');
  const undoPay = (s) => setFlags(s, { paid_to_agent: false, paid_to_agent_date: null });

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
        const split = splitFor(s, agentEmail);
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

  // Agrupar la pestaña "Pagadas" por fecha de pago al agente (dropdown por fecha)
  const NO_DATE = 'sin_fecha';
  const dateGroups = useMemo(() => {
    if (activeTab !== 'pagadas') return [];
    const byDate = visibleRows.reduce((acc, r) => {
      const key = r.service.paid_to_agent_date || NO_DATE;
      (acc[key] = acc[key] || []).push(r);
      return acc;
    }, {});
    return Object.entries(byDate)
      .map(([date, list]) => ({ date, list }))
      .sort((a, b) => {
        if (a.date === NO_DATE) return 1;
        if (b.date === NO_DATE) return -1;
        const da = parseLocalDate(a.date) || new Date(0);
        const db = parseLocalDate(b.date) || new Date(0);
        return sortOrder === 'asc' ? da - db : db - da;
      });
  }, [activeTab, visibleRows, sortOrder]);

  const toggleAgent = (agent) => setExpanded(prev => {
    const n = new Set(prev); n.has(agent) ? n.delete(agent) : n.add(agent); return n;
  });
  const toggleTrip = (tripId) => setExpandedTrips(prev => {
    const n = new Set(prev); n.has(tripId) ? n.delete(tripId) : n.add(tripId); return n;
  });
  const toggleDate = (date) => setExpandedDates(prev => {
    const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n;
  });
  const toggleCierre = (tripId) => setExpandedCierre(prev => {
    const n = new Set(prev); n.has(tripId) ? n.delete(tripId) : n.add(tripId); return n;
  });

  // ---- "Cierre mensual": reconciliación por viaje (traspaso Operaciones → Revenue) ----
  // Candidatas: comisiones de viajes ya terminados que todavía NO están en Revenue
  // (ni confirmadas ni pagadas al agente). Se agrupan por viaje y se calcula el
  // veredicto del traspaso (netas) o la validación del depósito (brutas).
  const cierreGroups = useMemo(() => {
    if (activeTab !== 'cierre') return [];
    const candidates = filteredRows.filter(r =>
      !r.service.commission_paid && !r.service.paid_to_agent && tripEnded(r.trip)
    );
    const byTrip = candidates.reduce((acc, r) => {
      const id = r.trip?.id || r.service.sold_trip_id;
      if (!acc[id]) acc[id] = { tripId: id, trip: r.trip, agentName: r.agentName, rows: [] };
      acc[id].rows.push(r);
      return acc;
    }, {});
    return Object.values(byTrip).map(g => {
      const fin = tripFinancials[g.tripId] || { gross: 0, net: 0, clientIn: 0, nomadOut: 0, saldo: 0 };
      const netRows = g.rows.filter(r => isNetService(r.service));
      const grossRows = g.rows.filter(r => !isNetService(r.service));
      const pendingNet = netRows.reduce((s, r) => s + (r.service.commission || 0), 0);
      const pendingGross = grossRows.reduce((s, r) => s + (r.service.commission || 0), 0);
      const verdict = transferVerdict(fin.net, fin.saldo);
      return { ...g, fin, netRows, grossRows, pendingNet, pendingGross, verdict };
    }).sort((a, b) => {
      // Primero los que NO cuadran (requieren revisión), luego por fecha del viaje
      const aReview = a.netRows.length > 0 && a.verdict.type === 'revisar' ? 0 : 1;
      const bReview = b.netRows.length > 0 && b.verdict.type === 'revisar' ? 0 : 1;
      if (aReview !== bReview) return aReview - bReview;
      const da = a.trip ? (parseLocalDate(a.trip.end_date || a.trip.start_date) || new Date(0)) : new Date(0);
      const db = b.trip ? (parseLocalDate(b.trip.end_date || b.trip.start_date) || new Date(0)) : new Date(0);
      return sortOrder === 'asc' ? da - db : db - da;
    });
  }, [activeTab, filteredRows, tripFinancials, sortOrder]);

  // Totales de la pestaña de cierre
  const cierreStats = useMemo(() => {
    let porPasar = 0, porRevisar = 0, brutasPorConfirmar = 0, tripsRevisar = 0;
    cierreGroups.forEach(g => {
      if (g.netRows.length > 0) {
        if (g.verdict.type === 'pasar') porPasar += g.pendingNet;
        else { porRevisar += g.pendingNet; tripsRevisar += 1; }
      }
      brutasPorConfirmar += g.pendingGross;
    });
    return { porPasar, porRevisar, brutasPorConfirmar, tripsRevisar };
  }, [cierreGroups]);

  // Registrar el traspaso de las netas de un viaje a Revenue (guarda fecha y monto)
  const registerTransfer = async (group) => {
    const todayStr = new Date().toISOString().split('T')[0];
    for (const r of group.netRows) {
      await updateServiceMutation.mutateAsync({
        id: r.service.id,
        data: {
          paid_to_agency: true,
          commission_paid: true,
          revenue_transfer_date: r.service.revenue_transfer_date || todayStr,
          revenue_transfer_amount: r.service.commission || 0,
        },
      });
    }
    toast.success(`Traspaso registrado: ${money(group.pendingNet)} a Revenue`);
  };

  // Confirmar que el depósito directo de las brutas ya llegó a Revenue
  const confirmGrossDeposit = async (group) => {
    for (const r of group.grossRows) {
      await updateServiceMutation.mutateAsync({
        id: r.service.id,
        data: { paid_to_agency: true, commission_paid: true },
      });
    }
    toast.success('Depósito confirmado');
  };

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
    const todayStr = new Date().toISOString().split('T')[0];
    for (const r of selectedRows) {
      await updateServiceMutation.mutateAsync({
        id: r.service.id,
        data: {
          paid_to_agency: true,
          commission_paid: true,
          paid_to_agent: true,
          paid_to_agent_date: r.service.paid_to_agent_date || todayStr,
        },
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

  // Tarjeta de un viaje en la pestaña "Cierre mensual"
  const renderCierreCard = (g) => {
    const { tripId, trip, agentName, netRows, grossRows, pendingNet, pendingGross, fin, verdict } = g;
    const isOpen = expandedCierre.has(tripId);
    const refDate = trip?.end_date || trip?.start_date;
    const canTransfer = verdict.type === 'pasar';
    const allRows = [...netRows, ...grossRows];

    return (
      <div key={tripId} className="border-b border-stone-100 last:border-0 px-4 py-3.5">
        {/* Encabezado del viaje */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2E442A15' }}>
            <Wallet className="w-4 h-4" style={{ color: '#2E442A' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-stone-800 truncate">
              {trip ? `${trip.client_name} ${trip.destination || ''}`.trim() : 'Viaje'}
              {trip?.trip_name ? ` — ${trip.trip_name}` : ''}
            </p>
            <p className="text-xs text-stone-400">
              {agentName}{refDate ? ` · regresó ${formatDate(refDate, 'd MMM yyyy', { locale: es })}` : ''}
            </p>
          </div>
          {netRows.length > 0 && (
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md flex-shrink-0 ${
              canTransfer ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {canTransfer ? 'CUADRA' : 'NO CUADRA'}
            </span>
          )}
        </div>

        {/* NETAS: traspaso Operaciones → Revenue */}
        {netRows.length > 0 && (
          <div className={`mt-3 rounded-xl border px-3 py-2.5 ${canTransfer ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${canTransfer ? 'text-emerald-500' : 'text-red-500'}`}>
                  Netas · traspaso Operaciones → Revenue
                </p>
                <p className="text-sm text-stone-600 mt-0.5">
                  Comisiones netas <strong className="text-stone-800">{money(fin.net)}</strong>
                  <span className="mx-1.5 text-stone-300">·</span>
                  Saldo del cliente <strong className={fin.saldo < fin.net ? 'text-red-600' : 'text-stone-800'}>{money(fin.saldo)}</strong>
                </p>
                <p className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${canTransfer ? 'text-emerald-700' : 'text-red-700'}`}>
                  {canTransfer ? (
                    <><Check className="w-3.5 h-3.5" /> Pasar {money(pendingNet)} de Operaciones a Revenue</>
                  ) : (
                    <><AlertTriangle className="w-3.5 h-3.5" /> No pasar. Faltan {money(verdict.shortfall)} — revisar el viaje con {agentName}</>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => registerTransfer(g)}
                disabled={!canTransfer || pendingNet <= 0 || updateServiceMutation.isPending}
                className="h-8 rounded-lg text-xs text-white px-3 whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: canTransfer ? '#2E442A' : '#D1D5DB' }}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Registrar traspaso
              </Button>
            </div>
          </div>
        )}

        {/* BRUTAS: depósito directo a Revenue */}
        {grossRows.length > 0 && (
          <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Brutas · depósito directo a Revenue</p>
                <p className="text-sm text-stone-600 mt-0.5">
                  Comisiones brutas <strong className="text-stone-800">{money(pendingGross)}</strong> — validar que el depósito ya llegó
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => confirmGrossDeposit(g)}
                disabled={updateServiceMutation.isPending}
                className="h-8 rounded-lg text-xs px-3 whitespace-nowrap flex-shrink-0 border-stone-300"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" /> Confirmar depósito
              </Button>
            </div>
          </div>
        )}

        {/* Detalle de servicios (solo lectura) */}
        <button onClick={() => toggleCierre(tripId)} className="mt-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1">
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {allRows.length} servicio{allRows.length !== 1 ? 's' : ''} con comisión
        </button>
        {isOpen && (
          <div className="mt-1.5 space-y-1">
            {allRows.map(r => {
              const s = r.service;
              const net = isNetService(s);
              return (
                <div key={s.id} className="flex items-center gap-2 text-xs pl-1">
                  <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${net ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    {net ? 'NETO' : 'BRUTO'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-stone-600">{getServiceName(s)}</span>
                  <span className="font-semibold text-stone-700">{money(s.commission || 0)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderRow = (r) => {
    const s = r.service;
    const Icon = SERVICE_ICONS[s.service_type] || Package;
    const iconColors = SERVICE_ICON_COLORS[s.service_type] || SERVICE_ICON_COLORS.otro;
    const channel = getChannel(s);

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
          <p className="text-sm font-semibold text-stone-800 truncate">{getServiceName(s)}</p>
          <p className="text-xs text-stone-400 truncate">
            {activeTab === 'pagadas' ? `${r.agentName} · ` : ''}
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

        <div className="w-20 flex-shrink-0 hidden lg:block">
          <span className="text-xs font-medium text-stone-600">{IATA_LABELS[r.iata] || r.iata}</span>
        </div>

        <div className="w-24 flex-shrink-0 hidden lg:block min-w-0">
          <span className="text-xs text-stone-500 block truncate" title={channel}>{channel}</span>
        </div>

        <div className="w-20 flex-shrink-0 text-right hidden sm:block">
          <span className="text-sm font-semibold text-stone-700">{money(s.commission || 0)}</span>
        </div>

        <div className="w-32 flex-shrink-0 text-right">
          <p className={`text-sm font-bold ${r.split.isOwner ? 'text-emerald-700' : 'text-stone-800'}`}>{money(r.split.agent)}</p>
          <p className="text-[10px] text-stone-400 leading-tight whitespace-nowrap">
            {agentPct(r.split, s.commission || 0)}%{r.split.nomad > 0 && <> · Nomad {money(r.split.nomad)}</>}{r.split.montecito > 0 && <> · <span className="text-amber-600">Mtcto {money(r.split.montecito)}</span></>}
          </p>
        </div>

        <div className="w-40 flex-shrink-0 flex justify-end">
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
          const count = tab.key === 'cierre' ? cierreGroups.length : (buckets[tab.key]?.length || 0);
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelected([]); }}
              className={`pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                active ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}>
              {tab.label}
              {count > 0 ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab.key === 'cierre' ? 'bg-emerald-100 text-emerald-700'
                    : tab.key === 'pagadas_agencia' ? 'bg-amber-100 text-amber-600'
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

      {/* Cierre mensual: resumen del traspaso Operaciones → Revenue */}
      {activeTab === 'cierre' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Por pasar a Revenue" value={money(cierreStats.porPasar)} sub="Netas que cuadran con el saldo" valueClass="text-emerald-600" />
            <StatCard label="Netas por revisar" value={money(cierreStats.porRevisar)} sub={`${cierreStats.tripsRevisar} viaje${cierreStats.tripsRevisar !== 1 ? 's' : ''} · saldo no cuadra`} valueClass="text-red-600" />
            <StatCard label="Brutas por confirmar" value={money(cierreStats.brutasPorConfirmar)} sub="Depósito directo a Revenue" valueClass="text-orange-500" />
            <StatCard label="Viajes en cierre" value={cierreGroups.length} sub="Terminados y aún no en Revenue" />
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-600">
            Las comisiones <strong>netas</strong> entran a <strong>Operaciones</strong>; pásalas a <strong>Revenue</strong> solo cuando el saldo del cliente cuadre con las netas.
            Las <strong>brutas</strong> se depositan directo a Revenue: solo valida que el depósito ya haya llegado.
          </div>
        </>
      )}

      {/* Lista agrupada por agente */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {/* Encabezado de columnas (no aplica al cierre mensual, que va por viaje) */}
        {activeTab !== 'cierre' && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
          <span className="w-7 flex-shrink-0" />
          <span className="w-8 flex-shrink-0" />
          <span className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">Servicio · Viaje</span>
          <span className="w-24 flex-shrink-0 hidden md:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Tipo</span>
          <span className="w-20 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">IATA</span>
          <span className="w-24 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Canal</span>
          <span className="w-20 flex-shrink-0 hidden sm:block text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Comisión</span>
          <span className="w-32 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Agente</span>
          <span className="w-40 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Acción</span>
        </div>
        )}

        {/* Pestaña "Cierre mensual": una tarjeta por viaje con veredicto de traspaso */}
        {activeTab === 'cierre' && cierreGroups.map(renderCierreCard)}

        {/* Pestaña "Pagadas": agrupada por fecha de pago (dropdown por fecha) */}
        {activeTab === 'pagadas' && dateGroups.map(({ date, list }) => {
          const isOpen = expandedDates.has(date);
          const label = date === NO_DATE
            ? 'Sin fecha de pago'
            : (() => {
                const l = formatDate(date, "d 'de' MMMM yyyy", { locale: es });
                return l.charAt(0).toUpperCase() + l.slice(1);
              })();
          return (
            <div key={date} className="border-b border-stone-100 last:border-0">
              <button onClick={() => toggleDate(date)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left">
                <span className="w-7 flex justify-center text-stone-300">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2E442A15' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#2E442A' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-800 truncate">{label}</p>
                  <p className="text-xs text-stone-400">{list.length} comisión{list.length !== 1 ? 'es' : ''} pagada{list.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pagado a agentes</p>
                  <p className="text-sm font-bold text-green-600">{money(sumAgent(list))}</p>
                </div>
              </button>
              {isOpen && sortedRows(list).map(renderRow)}
            </div>
          );
        })}

        {activeTab !== 'pagadas' && activeTab !== 'cierre' && groups.map(({ agent, list }) => {
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
                const fin = tripFinancials[tripId] || { gross: 0, net: 0, clientIn: 0, nomadOut: 0, saldo: 0 };
                const matchesNet = Math.abs(fin.saldo - fin.net) < 1;
                return (
                  <div key={tripId} className="border-t border-stone-100 bg-stone-50/30">
                    <button onClick={() => toggleTrip(tripId)} className="w-full flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-stone-100/60 transition-colors text-left">
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

                    {tripOpen && sortedRows(rows).map(renderRow)}

                    {tripOpen && (
                      <div className="pl-12 pr-4 py-3 border-t border-stone-100 bg-white">
                        <div className="flex flex-wrap items-stretch gap-2">
                          <div className="flex-1 min-w-[130px] rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Comisión bruta</p>
                            <p className="text-sm font-bold text-orange-600">{money(fin.gross)}</p>
                          </div>
                          <div className="flex-1 min-w-[130px] rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">Comisión neta</p>
                            <p className="text-sm font-bold text-green-700">{money(fin.net)}</p>
                          </div>
                          <div className={`flex-1 min-w-[180px] rounded-lg border px-3 py-2 ${matchesNet ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Saldo en cuenta</p>
                              {matchesNet
                                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                : <span className="text-[10px] text-stone-400">vs neto {money(fin.net)}</span>}
                            </div>
                            <p className={`text-sm font-bold ${fin.saldo < 0 ? 'text-red-600' : 'text-stone-800'}`}>{money(fin.saldo)}</p>
                            <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                              Cliente pagó {money(fin.clientIn)} − Nomad pagó {money(fin.nomadOut)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {(activeTab === 'cierre' ? cierreGroups.length === 0 : activeTab === 'pagadas' ? dateGroups.length === 0 : groups.length === 0) && (
          <div className="p-10 text-center text-stone-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-stone-200" />
            <p className="text-sm">{activeTab === 'cierre' ? 'No hay viajes pendientes de traspaso o depósito' : 'No hay comisiones en esta etapa'}</p>
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
    </div>
  );
}
