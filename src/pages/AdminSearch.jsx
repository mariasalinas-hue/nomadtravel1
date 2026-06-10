import { useState, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Loader2, Search, SearchX, ExternalLink } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* Etiquetas de métodos de pago (cliente + proveedor) */
const METHOD_LABELS = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  link_pago: 'Link de Pago',
  tarjeta: 'Tarjeta',
  tarjeta_cliente: 'Tarjeta del Cliente',
  ms_beyond: 'MS Beyond',
  capital_one_blue: 'Capital One Blue',
  capital_one_green: 'Capital One Green',
  amex: 'American Express',
  amex_verde: 'Amex Verde',
  otro: 'Otro',
};

const CHANNEL_LABELS = {
  virtuoso: 'Virtuoso', preferred_partner: 'Preferred Partner', tbo: 'TBO',
  expedia_taap: 'Expedia TAAP', ratehawk: 'RateHawk', tablet_hotels: 'Tablet Hotels',
  dmc: 'DMC', otro: 'Otro',
  creative_travel: 'Creative Travel', directo: 'Directo',
  international_cruises: 'International Cruises', cruceros_57: 'Cruceros 57', pema: 'PeMA',
  ytc: 'YTC', ez_travel: 'EZ Travel', lozano_travel: 'Lozano Travel', consofly: 'Consofly',
};

const SERVICE_TYPE_LABELS = {
  hotel: 'Hotel', vuelo: 'Vuelo', traslado: 'Traslado', tour: 'Tour',
  crucero: 'Crucero', tren: 'Tren', dmc: 'DMC', otro: 'Otro'
};

const KIND_CONFIG = {
  servicio: { label: 'Servicio', badge: 'bg-sky-50 text-sky-600' },
  pago_proveedor: { label: 'Pago Proveedor', badge: 'bg-orange-50 text-orange-600' },
  pago_cliente: { label: 'Pago Cliente', badge: 'bg-green-50 text-green-600' },
};

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const getServiceName = (s) => {
  const m = s.metadata || {};
  switch (s.service_type) {
    case 'hotel': return s.hotel_name || m.hotel_name || s.hotel_chain || 'Hotel';
    case 'vuelo': return `${s.airline || m.airline || 'Vuelo'} ${s.route || ''}`.trim();
    case 'traslado': return `${s.transfer_origin || ''} → ${s.transfer_destination || ''}`.trim() || 'Traslado';
    case 'tour': return s.tour_name || m.tour_name || 'Tour';
    case 'crucero': return s.cruise_ship || s.cruise_line || 'Crucero';
    case 'tren': return `${s.train_operator || 'Tren'} ${s.train_route || ''}`.trim();
    case 'dmc': return s.dmc_name || 'DMC';
    default: return s.other_name || s.other_description || 'Servicio';
  }
};

// El precio puede vivir en price (campo que guarda el formulario), total_price o metadata
const getServicePrice = (s) => {
  const m = s.metadata || {};
  return Number(s.price || s.total_price || m.price || m.total_price || 0);
};

const getServiceDate = (s) =>
  s.check_in || s.flight_date || s.tour_date || s.transfer_datetime
  || s.cruise_departure_date || s.train_date || s.dmc_date || s.other_date
  || (s.created_date ? String(s.created_date).slice(0, 10) : null);

const getServiceChannel = (s) => {
  const raw = s.reserved_by || s.flight_consolidator || s.cruise_provider || s.train_provider;
  return raw ? (CHANNEL_LABELS[raw] || raw) : '';
};

const getReservationNumber = (s) =>
  s.reservation_number || s.flight_reservation_number || s.tour_reservation_number
  || s.cruise_reservation_number || s.dmc_reservation_number || s.train_reservation_number || '';

// Ciudad/ubicación específica del servicio
const getServiceCity = (s) => {
  const m = s.metadata || {};
  switch (s.service_type) {
    case 'hotel': return s.hotel_city || m.hotel_city || '';
    case 'tour': return s.tour_city || m.tour_city || '';
    case 'traslado': return s.transfer_destination || s.transfer_origin || '';
    case 'crucero': return s.cruise_departure_port || s.cruise_arrival_port || '';
    case 'tren': return s.train_route || '';
    case 'dmc': return s.dmc_destination || '';
    default: return s.other_city || m.other_city || '';
  }
};

export default function AdminSearch() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amount, setAmount] = useState('');
  const [tolerance, setTolerance] = useState('5');
  const [method, setMethod] = useState('all');
  const [agent, setAgent] = useState('all');
  const [serviceType, setServiceType] = useState('all');
  const [city, setCity] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['adminGlobalSearch'],
    queryFn: async () => {
      const [trips, services, supplierPayments, clientPayments] = await Promise.all([
        supabaseAPI.entities.SoldTrip.list(),
        supabaseAPI.entities.TripService.list(),
        supabaseAPI.entities.SupplierPayment.list(),
        supabaseAPI.entities.ClientPayment.list(),
      ]);
      return { trips, services, supplierPayments, clientPayments };
    },
    refetchOnWindowFocus: false,
  });

  // Filas unificadas de las 3 fuentes
  const rows = useMemo(() => {
    if (!data) return [];
    const tripsMap = data.trips.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

    const out = [];

    data.services.forEach(s => {
      const trip = tripsMap[s.sold_trip_id];
      out.push({
        kind: 'servicio',
        id: `s_${s.id}`,
        date: getServiceDate(s),
        name: getServiceName(s),
        detail: [SERVICE_TYPE_LABELS[s.service_type] || s.service_type, getServiceChannel(s), getReservationNumber(s) && `#${getReservationNumber(s)}`].filter(Boolean).join(' · '),
        amount: getServicePrice(s),
        method: getServiceChannel(s),
        serviceType: s.service_type,
        client: trip?.client_name || '—',
        agent: trip?.created_by || s.created_by || '—',
        tripId: s.sold_trip_id,
        destination: trip?.destination || '',
        city: getServiceCity(s) || trip?.destination || '',
        notes: s.notes || '',
      });
    });

    data.supplierPayments.forEach(p => {
      const trip = tripsMap[p.sold_trip_id];
      out.push({
        kind: 'pago_proveedor',
        id: `sp_${p.id}`,
        date: p.date,
        name: p.supplier || 'Proveedor',
        detail: [METHOD_LABELS[p.method] || p.method, p.payment_type === 'neto' ? 'Neto' : 'Bruto'].filter(Boolean).join(' · '),
        amount: p.amount || 0,
        method: p.method,
        serviceType: null,
        client: trip?.client_name || '—',
        agent: trip?.created_by || p.created_by || '—',
        tripId: p.sold_trip_id,
        destination: trip?.destination || '',
        city: trip?.destination || '',
        notes: p.notes || '',
      });
    });

    data.clientPayments.forEach(p => {
      const trip = tripsMap[p.sold_trip_id];
      const usd = p.amount_usd_fixed || p.amount || 0;
      out.push({
        kind: 'pago_cliente',
        id: `cp_${p.id}`,
        date: p.date,
        name: trip?.client_name || 'Pago de cliente',
        detail: [
          METHOD_LABELS[p.method] || p.method,
          p.bank && p.bank.toUpperCase().replace('_', ' '),
          p.currency && p.currency !== 'USD' && `${(p.amount_original || 0).toLocaleString()} ${p.currency}`
        ].filter(Boolean).join(' · '),
        amount: usd,
        method: p.method,
        serviceType: null,
        client: trip?.client_name || '—',
        agent: trip?.created_by || p.created_by || '—',
        tripId: p.sold_trip_id,
        destination: trip?.destination || '',
        city: trip?.destination || '',
        notes: p.notes || '',
      });
    });

    return out;
  }, [data]);

  const agents = useMemo(() => {
    const set = new Set(rows.map(r => r.agent).filter(a => a && a !== '—'));
    return [...set].sort();
  }, [rows]);

  const cities = useMemo(() => {
    const set = new Set(rows.map(r => (r.city || '').trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Aplicar filtros
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const amountNum = parseFloat(amount);
    const tolPct = parseFloat(tolerance) || 0;
    const from = dateFrom ? parseLocalDate(dateFrom) : null;
    const to = dateTo ? parseLocalDate(dateTo) : null;

    return rows.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (agent !== 'all' && r.agent !== agent) return false;
      if (method !== 'all' && r.method !== method) return false;
      if (serviceType !== 'all' && (r.kind !== 'servicio' || r.serviceType !== serviceType)) return false;
      if (city !== 'all' && (r.city || '').trim() !== city) return false;

      if (from || to) {
        const d = parseLocalDate(r.date);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }

      if (!isNaN(amountNum) && amountNum > 0) {
        const margin = amountNum * (tolPct / 100);
        if (Math.abs(r.amount - amountNum) > margin + 0.001) return false;
      }

      if (q) {
        const blob = `${r.name} ${r.detail} ${r.client} ${r.agent} ${r.destination} ${r.notes}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = parseLocalDate(a.date) || new Date(0);
      const db = parseLocalDate(b.date) || new Date(0);
      return db - da;
    });
  }, [rows, query, kind, agent, method, serviceType, city, dateFrom, dateTo, amount, tolerance]);

  const totalShown = filtered.reduce((sum, r) => sum + r.amount, 0);
  const hasActiveFilters = query || kind !== 'all' || dateFrom || dateTo || amount || method !== 'all' || agent !== 'all' || serviceType !== 'all' || city !== 'all';

  const clearFilters = () => {
    setQuery(''); setKind('all'); setDateFrom(''); setDateTo('');
    setAmount(''); setTolerance('5'); setMethod('all'); setAgent('all'); setServiceType('all'); setCity('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Buscador Global</h1>
        <p className="text-stone-500 text-sm mt-1">
          Encuentra cualquier servicio, pago a proveedor o pago de cliente — de todos los agentes
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Buscar por cliente, agente, proveedor, destino, # reservación, notas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 rounded-xl"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo tipo</SelectItem>
              <SelectItem value="servicio">Servicios</SelectItem>
              <SelectItem value="pago_proveedor">Pagos a proveedores</SelectItem>
              <SelectItem value="pago_cliente">Pagos de clientes</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl text-xs h-9" title="Desde" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl text-xs h-9" title="Hasta" />

          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Monto $"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-xl text-xs h-9"
          />
          <Select value={tolerance} onValueChange={setTolerance}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Monto exacto</SelectItem>
              <SelectItem value="1">± 1%</SelectItem>
              <SelectItem value="5">± 5%</SelectItem>
              <SelectItem value="10">± 10%</SelectItem>
              <SelectItem value="20">± 20%</SelectItem>
            </SelectContent>
          </Select>

          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Método" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo método</SelectItem>
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo agente</SelectItem>
              {agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Tipo servicio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo servicio</SelectItem>
              {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Ciudad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda ciudad</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500">
            <strong>{filtered.length.toLocaleString()}</strong> resultado{filtered.length !== 1 ? 's' : ''}
            {filtered.length > 0 && <> · Suma: <strong>{money(totalShown)} USD</strong></>}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-stone-500 h-7">
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Resultados */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Tipo</th>
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Fecha</th>
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Concepto</th>
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Cliente</th>
                <th className="text-left p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Agente</th>
                <th className="text-right p-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Monto</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.slice(0, 300).map(r => {
                const kindCfg = KIND_CONFIG[r.kind];
                return (
                  <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3">
                      <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md whitespace-nowrap ${kindCfg.badge}`}>
                        {kindCfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-stone-600 whitespace-nowrap">
                      {formatDate(r.date, 'd MMM yyyy', { locale: es })}
                    </td>
                    <td className="p-3 max-w-[260px]">
                      <p className="font-medium text-stone-800 truncate">{r.name}</p>
                      <p className="text-xs text-stone-400 truncate">{r.detail}{r.destination && ` · ${r.destination}`}</p>
                    </td>
                    <td className="p-3 text-stone-700">{r.client}</td>
                    <td className="p-3 text-stone-500 text-xs">{r.agent}</td>
                    <td className="p-3 text-right font-semibold text-stone-800 whitespace-nowrap">{money(r.amount)}</td>
                    <td className="p-3">
                      {r.tripId && (
                        <Link
                          to={createPageUrl(`SoldTripDetail?id=${r.tripId}`)}
                          className="text-stone-300 hover:text-stone-600"
                          title="Abrir viaje"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-stone-400">
            <SearchX className="w-10 h-10 mx-auto mb-3 text-stone-200" />
            <p className="text-sm">Sin resultados con estos filtros</p>
          </div>
        )}
        {filtered.length > 300 && (
          <div className="p-3 text-center text-xs text-stone-400 border-t border-stone-100">
            Mostrando los primeros 300 de {filtered.length.toLocaleString()} — afina los filtros para acotar
          </div>
        )}
      </div>
    </div>
  );
}
