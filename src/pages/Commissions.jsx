import { useState, useContext, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ViewModeContext } from '@/Layout';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { updateSoldTripTotalsFromServices } from '@/components/utils/soldTripRecalculations';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2, Search, ChevronDown, ChevronUp, Check, Undo2, FileText, Pencil,
  Hotel, Plane, Car, Compass, Ship, Train, Briefcase, Package, DollarSign
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AgentInvoiceGenerator from '@/components/commissions/AgentInvoiceGenerator';
import { agentRateOf, rateForService, splitCommission } from '@/components/utils/commissionSplit';

const RESERVED_BY_LABELS = {
  virtuoso: 'Virtuoso',
  preferred_partner: 'Preferred Partner',
  tbo: 'TBO',
  expedia_taap: 'Expedia TAAP',
  ratehawk: 'RateHawk',
  tablet_hotels: 'Tablet Hotels',
  dmc: 'DMC',
  otro: 'Otro'
};

const CRUISE_PROVIDER_LABELS = {
  creative_travel: 'Creative Travel',
  directo: 'Directo',
  international_cruises: 'International Cruises',
  cruceros_57: 'Cruceros 57',
  pema: 'PeMA'
};

const SERVICE_ICONS = { hotel: Hotel, vuelo: Plane, traslado: Car, tour: Compass, crucero: Ship, tren: Train, dmc: Briefcase, otro: Package };
const SERVICE_ICON_COLORS = {
  hotel: 'bg-rose-50 text-rose-500',
  vuelo: 'bg-sky-50 text-sky-500',
  traslado: 'bg-amber-50 text-amber-500',
  tour: 'bg-emerald-50 text-emerald-500',
  crucero: 'bg-cyan-50 text-cyan-500',
  tren: 'bg-pink-50 text-pink-500',
  dmc: 'bg-indigo-50 text-indigo-500',
  otro: 'bg-stone-100 text-stone-500'
};

// El reparto de comisión (tarifa/tier por agente, congelada al pagar) vive en commissionSplit.js

const money = (n) => `$${Math.round(n).toLocaleString()}`;

const getServiceName = (service) => {
  const m = service.metadata || {};
  switch (service.service_type) {
    case 'hotel':
      return service.hotel_name || m.hotel_name || service.service_name || service.hotel_chain || m.hotel_chain || 'Hotel';
    case 'vuelo':
      return service.airline || m.airline || service.service_name || 'Vuelo';
    case 'traslado': {
      const origin = service.transfer_origin || m.transfer_origin || '';
      const dest = service.transfer_destination || m.transfer_destination || '';
      return (origin || dest) ? `${origin} → ${dest}` : (service.service_name || 'Traslado');
    }
    case 'tour':
      return service.tour_name || m.tour_name || service.service_name || 'Tour';
    case 'crucero':
      return service.cruise_ship || m.cruise_ship || service.cruise_line || m.cruise_line || service.service_name || 'Crucero';
    case 'tren':
      return `${service.train_operator || m.train_operator || 'Tren'} ${service.train_number || m.train_number || ''}`.trim() || service.service_name || 'Tren';
    case 'dmc':
      return service.dmc_name || m.dmc_name || service.service_name || 'DMC';
    case 'otro':
      return service.other_name || m.other_name || service.other_description || m.other_description || service.service_name || 'Servicio';
    default:
      return service.service_name || 'Servicio';
  }
};

// Etiquetas de todos los canales de reservación (hoteles, consolidadores de
// vuelo, proveedores de crucero/tren) para que TODA comisión muestre su canal.
const CHANNEL_LABELS = {
  ...RESERVED_BY_LABELS,
  ...CRUISE_PROVIDER_LABELS,
  ytc: 'YTC',
  directo: 'Directo',
  ez_travel: 'EZ Travel',
  lozano_travel: 'Lozano Travel',
  consofly: 'Consofly',
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

// Subtítulo descriptivo del servicio (sin duplicar el canal)
const getSubtitle = (service) => {
  const m = service.metadata || {};
  switch (service.service_type) {
    case 'hotel':
      return [service.hotel_chain || m.hotel_chain, service.hotel_brand || m.hotel_brand].filter(Boolean).join(' · ') || 'Hotel';
    case 'vuelo':
      return service.route || m.route || 'Vuelo';
    case 'traslado':
      return service.transfer_type === 'privado' ? 'Traslado privado' : 'Traslado';
    case 'tour':
      return service.tour_city || m.tour_city || 'Tour';
    case 'crucero':
      return service.cruise_line || m.cruise_line || service.cruise_itinerary || m.cruise_itinerary || 'Crucero';
    case 'tren':
      return service.train_route || m.train_route || 'Tren';
    case 'dmc':
      return service.dmc_destination || m.dmc_destination || 'DMC';
    default:
      return service.other_description || m.other_description || 'Servicio';
  }
};

export default function Commissions() {
  const { viewMode, isActualAdmin } = useContext(ViewModeContext);
  const { user: clerkUser } = useSpoofableUser();

  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
  } : null;

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('proximas');
  const [expandedTrips, setExpandedTrips] = useState(() => new Set());
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState(null); // { id, value }

  const queryClient = useQueryClient();

  // Admin real viene del allowlist de emails (ViewModeContext), no de Clerk publicMetadata
  const isAdmin = isActualAdmin && viewMode === 'admin';

  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['allServices', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      const allTrips = isAdmin
        ? await supabaseAPI.entities.SoldTrip.list()
        : await supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
      const tripIds = allTrips.map(t => t.id);
      const allSvcs = await supabaseAPI.entities.TripService.list();
      return allSvcs.filter(s => tripIds.includes(s.sold_trip_id));
    },
    enabled: !!user,
    refetchOnWindowFocus: true
  });

  const { data: soldTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list();
      return supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
    },
    enabled: !!user,
    refetchOnWindowFocus: true
  });

  // Pagos (de cliente y a proveedores) para calcular el saldo por viaje
  const tripIdSet = new Set(soldTrips.map(t => t.id));
  const { data: clientPayments = [] } = useQuery({
    queryKey: ['allClientPayments', user?.email, isAdmin],
    queryFn: async () => {
      const all = await supabaseAPI.entities.ClientPayment.list();
      return all.filter(p => tripIdSet.has(p.sold_trip_id));
    },
    enabled: !!user && soldTrips.length > 0,
    refetchOnWindowFocus: true
  });
  const { data: supplierPayments = [] } = useQuery({
    queryKey: ['allSupplierPayments', user?.email, isAdmin],
    queryFn: async () => {
      const all = await supabaseAPI.entities.SupplierPayment.list();
      return all.filter(p => tripIdSet.has(p.sold_trip_id));
    },
    enabled: !!user && soldTrips.length > 0,
    refetchOnWindowFocus: true
  });

  // Usuarios (para la tarifa/tier de comisión de cada agente)
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => supabaseAPI.entities.User.list(),
    enabled: !!user,
  });
  const usersByEmail = useMemo(() => users.reduce((a, u) => { a[(u.email || '').toLowerCase()] = u; return a; }, {}), [users]);

  // Resumen financiero por viaje: comisión bruta/neta y saldo en cuenta.
  // Saldo = lo que el cliente pagó a Nomad − lo que Nomad pagó a proveedores.
  // Se EXCLUYE lo pagado con tarjeta del cliente (ese dinero no pasa por la cuenta de Nomad).
  const tripFinancials = useMemo(() => {
    const map = {};
    const ensure = (id) => (map[id] = map[id] || { gross: 0, net: 0, clientIn: 0, nomadOut: 0 });

    allServices.forEach(s => {
      if (!(s.commission > 0)) return;
      const e = ensure(s.sold_trip_id);
      if (s.payment_type === 'neto') e.net += s.commission;
      else e.gross += s.commission;
    });
    clientPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return; // no pasa por Nomad
      ensure(p.sold_trip_id).clientIn += (p.amount_usd_fixed || p.amount || 0);
    });
    supplierPayments.forEach(p => {
      if (p.method === 'tarjeta_cliente') return; // pagado con tarjeta del cliente, no sale de Nomad
      ensure(p.sold_trip_id).nomadOut += (p.amount || 0);
    });

    Object.values(map).forEach(e => { e.saldo = e.clientIn - e.nomadOut; });
    return map;
  }, [allServices, clientPayments, supplierPayments]);

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
    },
    onError: () => toast.error('No se pudo actualizar la comisión')
  });

  // Agente reporta que el proveedor ya pagó a la agencia. Solo marca paid_to_agency;
  // la confirmación de que el dinero llegó la hace el admin en Comisiones Internas
  // (commission_paid), y el pago final al agente también (paid_to_agent).
  const markPaidToAgency = (service) => {
    updateServiceMutation.mutate({
      id: service.id,
      data: {
        paid_to_agency: true,
        paid_to_agency_date: service.paid_to_agency_date || new Date().toISOString().split('T')[0]
      }
    });
  };

  const undoPaidToAgency = (service) => {
    updateServiceMutation.mutate({
      id: service.id,
      data: { paid_to_agency: false, paid_to_agency_date: null }
    });
  };

  // Edición inline de la comisión (clic en el monto)
  const saveCommission = (service) => {
    if (!editingCommission || editingCommission.id !== service.id) return;
    const value = parseFloat(editingCommission.value);
    if (isNaN(value) || value < 0) {
      toast.error('El monto debe ser un número válido mayor o igual a cero');
      return;
    }
    if (value !== (service.commission || 0)) {
      updateServiceMutation.mutate(
        { id: service.id, data: { commission: value } },
        {
          // El total de comisión del viaje depende de los servicios: recalcular
          onSuccess: () => updateSoldTripTotalsFromServices(service.sold_trip_id, queryClient)
        }
      );
    }
    setEditingCommission(null);
  };

  const tripsMap = soldTrips.reduce((acc, trip) => { acc[trip.id] = trip; return acc; }, {});

  // Parte del agente por servicio, según su tarifa (tier) y congelada si ya se pagó.
  const rateOfService = (s) => {
    const trip = tripsMap[s.sold_trip_id];
    const u = usersByEmail[(trip?.created_by || user?.email || '').toLowerCase()];
    return rateForService(s, agentRateOf(u));
  };
  const agentShareOf = (s) => splitCommission(s, rateOfService(s)).agent;
  const sumAgentShare = (list) => list.reduce((sum, s) => sum + agentShareOf(s), 0);
  // Tarifa actual del agente que está viendo la pantalla.
  const myRatePct = Math.round(agentRateOf(usersByEmail[(user?.email || '').toLowerCase()]) * 100);

  // ¿El viaje ya terminó? (las comisiones pasan automáticamente a "Por cobrar")
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripEnded = (trip) => {
    if (!trip) return false;
    const ref = trip.end_date || trip.start_date;
    const d = parseLocalDate(ref);
    return d ? d < today : false;
  };

  // Clasificación de cada comisión en su etapa del ciclo de vida (5 etapas)
  const bucketOf = (service) => {
    if (service.paid_to_agent) return 'cobradas';
    if (service.commission_paid) return 'confirmadas';     // admin confirmó que la agencia recibió
    if (service.paid_to_agency) return 'pagadas_agencia';  // el agente reportó, falta confirmar
    return tripEnded(tripsMap[service.sold_trip_id]) ? 'por_cobrar' : 'proximas';
  };

  const commissionServices = allServices.filter(s => (s.commission || 0) > 0);

  const buckets = { proximas: [], por_cobrar: [], pagadas_agencia: [], confirmadas: [], cobradas: [] };
  commissionServices.forEach(s => buckets[bucketOf(s)].push(s));

  // ---- Stats globales (no cambian con búsqueda ni pestaña) ----
  const sumCommission = (list) => list.reduce((sum, s) => sum + (s.commission || 0), 0);
  const totalComisiones = sumCommission(commissionServices);
  const miParteTotal = sumAgentShare(commissionServices);
  const porCobrarTotal = sumAgentShare([...buckets.por_cobrar, ...buckets.pagadas_agencia, ...buckets.confirmadas]);
  const cobradasTotal = sumAgentShare(buckets.cobradas);

  // Total de comisiones ya cobradas por el agente (para mostrar progreso)
  const tierProgress = cobradasTotal;

  // ---- Stats de la pestaña activa ----
  const proximasTotal = sumCommission(buckets.proximas);
  const futureTrips = new Set(buckets.proximas.map(s => s.sold_trip_id));
  const bestMonth = (() => {
    const byMonth = {};
    buckets.proximas.forEach(s => {
      const ref = s.commission_payment_date || tripsMap[s.sold_trip_id]?.end_date || tripsMap[s.sold_trip_id]?.start_date;
      const d = parseLocalDate(ref);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[key] = (byMonth[key] || 0) + (s.commission || 0);
    });
    const top = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
    if (!top) return '—';
    const [year, month] = top[0].split('-').map(Number);
    const label = formatDate(new Date(year, month, 1), 'MMM yyyy', { locale: es });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();
  const porCobrarNeto = sumAgentShare(buckets.por_cobrar.filter(s => s.payment_type === 'neto'));
  const porCobrarBruto = sumAgentShare(buckets.por_cobrar.filter(s => s.payment_type !== 'neto'));

  // ---- Búsqueda + agrupación por viaje ----
  const q = search.toLowerCase();
  const matchesSearch = (service) => {
    if (!q) return true;
    const trip = tripsMap[service.sold_trip_id];
    return (trip?.client_name || '').toLowerCase().includes(q)
      || (trip?.destination || '').toLowerCase().includes(q)
      || (trip?.trip_name || '').toLowerCase().includes(q)
      || getServiceName(service).toLowerCase().includes(q);
  };

  const visibleServices = buckets[activeTab].filter(matchesSearch);

  const tripGroups = Object.values(
    visibleServices.reduce((acc, s) => {
      if (!acc[s.sold_trip_id]) {
        acc[s.sold_trip_id] = { trip: tripsMap[s.sold_trip_id], services: [] };
      }
      acc[s.sold_trip_id].services.push(s);
      return acc;
    }, {})
  ).sort((a, b) => {
    const da = parseLocalDate(a.trip?.end_date || a.trip?.start_date) || new Date(0);
    const db = parseLocalDate(b.trip?.end_date || b.trip?.start_date) || new Date(0);
    return da - db;
  });

  const toggleTrip = (tripId) => {
    setExpandedTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId); else next.add(tripId);
      return next;
    });
  };

  const TABS = [
    { key: 'proximas', label: 'Próximas' },
    { key: 'por_cobrar', label: 'Por cobrar' },
    { key: 'pagadas_agencia', label: 'Pagadas a agencia' },
    { key: 'confirmadas', label: 'Confirmadas' },
    { key: 'cobradas', label: 'Cobradas' },
  ];

  const isLoading = servicesLoading || tripsLoading;

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

  const renderServiceRow = (service) => {
    const Icon = SERVICE_ICONS[service.service_type] || Package;
    const iconColors = SERVICE_ICON_COLORS[service.service_type] || SERVICE_ICON_COLORS.otro;
    const split = splitCommission(service, rateOfService(service));
    const isNeto = service.payment_type === 'neto';
    const bucket = bucketOf(service);

    const channel = getChannel(service);

    return (
      <div key={service.id} className="flex items-center gap-3 px-4 py-3 border-t border-stone-100 bg-stone-50/40">
        <span className="w-7 flex-shrink-0" />
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Nombre */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 truncate">{getServiceName(service)}</p>
          <p className="text-xs text-stone-400 truncate">{getSubtitle(service)}</p>
        </div>

        {/* Tipo */}
        <div className="w-14 flex-shrink-0 hidden md:block">
          <span className={`text-[10px] font-bold tracking-wider ${isNeto ? 'text-green-600' : 'text-orange-500'}`}>
            {isNeto ? 'NETO' : 'BRUTO'}
          </span>
        </div>

        {/* IATA */}
        <div className="w-20 flex-shrink-0 hidden lg:block">
          <span className="text-xs font-medium text-stone-600">
            {split.bookedBy === 'montecito' ? 'Montecito' : 'Nomad'}
          </span>
        </div>

        {/* Canal */}
        <div className="w-28 flex-shrink-0 hidden lg:block min-w-0">
          <span className="text-xs text-stone-500 block truncate" title={channel}>{channel}</span>
        </div>

        {/* Comisión (editable con clic) */}
        <div className="w-24 flex-shrink-0 text-right hidden sm:block">
          {editingCommission?.id === service.id ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={editingCommission.value}
              onChange={(e) => setEditingCommission({ id: service.id, value: e.target.value })}
              onBlur={() => saveCommission(service)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditingCommission(null);
              }}
              className="h-7 w-24 text-right text-sm rounded-lg px-2"
            />
          ) : (
            <button
              onClick={() => setEditingCommission({ id: service.id, value: service.commission || 0 })}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700 px-2 py-1 -mr-2 rounded-lg border border-stone-200 bg-white hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Clic para editar la comisión"
            >
              {money(service.commission || 0)}
              <Pencil className="w-3 h-3 text-stone-400" />
            </button>
          )}
        </div>

        {/* Mi parte (el desglose Nomad/Montecito es solo para admin) */}
        <div className="w-36 flex-shrink-0 text-right">
          <p className="text-sm font-bold text-stone-800">{money(split.agent)}</p>
          {isAdmin && (
            <p className="text-[10px] text-stone-400 leading-tight whitespace-nowrap">
              {Math.round(split.rate * 100)}% · Nomad {money(split.nomad)}{split.montecito > 0 && <> · <span className="text-amber-600">Mtcto {money(split.montecito)}</span></>}
            </p>
          )}
        </div>

        {/* Acción */}
        <div className="w-36 flex-shrink-0 flex justify-end">
          {bucket === 'proximas' && (
            <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-violet-50 text-violet-500">ESTIMADA</span>
          )}
          {bucket === 'por_cobrar' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markPaidToAgency(service)}
              disabled={updateServiceMutation.isPending}
              className="h-7 rounded-lg text-xs border-stone-300 px-2 whitespace-nowrap"
            >
              <Check className="w-3 h-3 mr-1" /> Pagado a agencia
            </Button>
          )}
          {bucket === 'pagadas_agencia' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-amber-50 text-amber-600">POR CONFIRMAR</span>
              <button
                onClick={() => undoPaidToAgency(service)}
                title="Deshacer"
                className="p-1 rounded text-stone-300 hover:text-stone-500"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {bucket === 'confirmadas' && (
            <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-600">LISTA PARA PAGO</span>
          )}
          {bucket === 'cobradas' && (
            <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md bg-green-50 text-green-600">COBRADA</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-stone-800">Mis comisiones</h1>
          <p className="text-stone-400 text-sm">Seguimiento por servicio · 50% del total</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Cliente o destino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total comisiones" value={money(totalComisiones)} sub="Realizadas + próximas" />
        <StatCard label="Mi parte (50%)" value={money(miParteTotal)} sub="Lo que me corresponde" valueClass="text-stone-800" />
        <StatCard label="Por cobrar" value={money(porCobrarTotal)} sub="Pendientes de pago" valueClass="text-orange-500" />
        <StatCard label="Ya cobradas" value={money(cobradasTotal)} sub="Pagadas a mí" valueClass="text-green-600" />
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200 flex gap-6 overflow-x-auto">
        {TABS.map(tab => {
          const count = buckets[tab.key].length;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                active ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab.label}
              {count > 0 ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab.key === 'por_cobrar' ? 'bg-orange-100 text-orange-600' : 'bg-stone-100 text-stone-500'
                }`}>{count}</span>
              ) : (
                <span className="text-stone-300">—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tu comisión (tarifa fija asignada por administración) */}
      <div className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Tu comisión</span>
        <span className="text-sm font-bold" style={{ color: '#2E442A' }}>{myRatePct}%</span>
        <span className="flex-1" />
        <span className="text-xs text-stone-400">Cobrado: <strong className="text-stone-700">{money(tierProgress)} USD</strong></span>
      </div>

      {/* Stats de pestaña */}
      {activeTab === 'proximas' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Estimadas" value={money(proximasTotal)} sub="Total servicios futuros" valueClass="text-violet-600" />
          <StatCard label="Mi parte estimada" value={money(sumAgentShare(buckets.proximas))} sub="Tu parte del total" />
          <StatCard label="Viajes futuros" value={futureTrips.size} sub="Con comisiones registradas" />
          <StatCard label="Mejor mes" value={bestMonth} sub="Mayor comisión estimada" valueClass="text-amber-600" />
        </div>
      )}
      {activeTab === 'por_cobrar' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total a cobrar" value={money(sumCommission(buckets.por_cobrar))} sub="Comisión total de servicios" />
          <StatCard label="Mi parte pendiente" value={money(sumAgentShare(buckets.por_cobrar))} sub="Tu parte del total" valueClass="text-orange-500" />
          <StatCard label="Neto (disponible)" value={money(porCobrarNeto)} sub="Ya en poder de la agencia" valueClass="text-green-600" />
          <StatCard label="Bruto (en espera)" value={money(porCobrarBruto)} sub="Pendiente de proveedor" valueClass="text-orange-500" />
        </div>
      )}
      {activeTab === 'pagadas_agencia' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>{buckets.pagadas_agencia.length}</strong> comisión{buckets.pagadas_agencia.length !== 1 ? 'es' : ''} esperando que administración confirme la recepción del pago
            · Mi parte: <strong>{money(sumAgentShare(buckets.pagadas_agencia))}</strong>
          </p>
        </div>
      )}
      {activeTab === 'confirmadas' && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-800">
            <strong>{buckets.confirmadas.length}</strong> comisión{buckets.confirmadas.length !== 1 ? 'es' : ''} confirmada{buckets.confirmadas.length !== 1 ? 's' : ''} por administración, lista{buckets.confirmadas.length !== 1 ? 's' : ''} para cobro
            · Mi parte: <strong>{money(sumAgentShare(buckets.confirmadas))}</strong>
          </p>
          {visibleServices.length > 0 && (
            <Button
              size="sm"
              onClick={() => setInvoiceDialogOpen(true)}
              className="text-white rounded-lg"
              style={{ backgroundColor: '#2E442A' }}
            >
              <FileText className="w-4 h-4 mr-1.5" /> Generar Factura ({visibleServices.length})
            </Button>
          )}
        </div>
      )}
      {activeTab === 'cobradas' && buckets.cobradas.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-800">
            <strong>{buckets.cobradas.length}</strong> comisión{buckets.cobradas.length !== 1 ? 'es' : ''} cobrada{buckets.cobradas.length !== 1 ? 's' : ''}
            · Total recibido: <strong>{money(sumAgentShare(buckets.cobradas))}</strong>
          </p>
        </div>
      )}

      {/* Lista agrupada por viaje */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {/* Encabezado de columnas (misma estructura que las filas de servicio) */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
          <span className="w-7 flex-shrink-0" />
          <span className="w-8 flex-shrink-0" />
          <span className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-stone-400">Servicio</span>
          <span className="w-14 flex-shrink-0 hidden md:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Tipo</span>
          <span className="w-20 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">IATA</span>
          <span className="w-28 flex-shrink-0 hidden lg:block text-[10px] font-bold uppercase tracking-wider text-stone-400">Canal</span>
          <span className="w-24 flex-shrink-0 hidden sm:block text-right text-[10px] font-bold uppercase tracking-wider text-stone-400 leading-tight">Comisión total</span>
          <span className="w-36 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Mi parte</span>
          <span className="w-36 flex-shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">Acción</span>
        </div>

        {tripGroups.map(({ trip, services: tripServices }) => {
          const tripId = trip?.id || tripServices[0].sold_trip_id;
          const expanded = expandedTrips.has(tripId);
          const total = sumCommission(tripServices);
          const refDate = trip?.end_date || trip?.start_date;

          return (
            <div key={tripId} className="border-b border-stone-100 last:border-0">
              {/* Fila del viaje (contraída por default) */}
              <button
                onClick={() => toggleTrip(tripId)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
              >
                <span className="w-7 flex justify-center text-stone-300">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-800 truncate">
                    {trip ? `${trip.client_name} ${trip.destination || ''}`.trim() : 'Viaje'}
                    {trip?.trip_name ? ` — ${trip.trip_name}` : ''}
                  </p>
                  <p className="text-xs text-stone-400">
                    {trip?.client_name}{refDate ? ` · ${formatDate(refDate, 'yyyy-MM-dd')}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total</p>
                  <p className="text-sm font-bold text-stone-700">{money(total)}</p>
                </div>
                <div className="text-right w-24">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Mi parte</p>
                  <p className="text-sm font-bold" style={{ color: '#2E442A' }}>{money(sumAgentShare(tripServices))}</p>
                </div>
              </button>

              {/* Servicios del viaje */}
              {expanded && tripServices.map(renderServiceRow)}

              {/* Resumen financiero del viaje */}
              {expanded && (() => {
                const fin = tripFinancials[tripId] || { gross: 0, net: 0, clientIn: 0, nomadOut: 0, saldo: 0 };
                const matchesNet = Math.abs(fin.saldo - fin.net) < 1;
                return (
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
                );
              })()}
            </div>
          );
        })}

        {tripGroups.length === 0 && (
          <div className="p-10 text-center text-stone-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-stone-200" />
            <p className="text-sm">No hay comisiones en esta etapa</p>
          </div>
        )}
      </div>

      {/* Generador de factura (comisiones pagadas a agencia, pendientes de pago al agente) */}
      <AgentInvoiceGenerator
        open={invoiceDialogOpen}
        onClose={() => setInvoiceDialogOpen(false)}
        services={activeTab === 'confirmadas' ? visibleServices : []}
        soldTrips={soldTrips}
        currentUser={user}
      />
    </div>
  );
}
