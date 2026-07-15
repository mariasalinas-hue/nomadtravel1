import { useState, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabaseAPI, supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { ViewModeContext } from '@/Layout';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameDay, isSameMonth, differenceInDays, startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/dateUtils';
import { parseLocalDate } from '@/components/utils/dateHelpers';
import {
  Loader2, Search, ChevronLeft, ChevronRight, CalendarDays, List,
  MapPin, Plane, Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BRAND = '#2E442A';

// Colores por estado del viaje (mismos estados que Viajes Vendidos)
const STATUS_META = {
  pendiente: { label: 'Pendiente', dot: '#eab308', chip: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  parcial: { label: 'Pago parcial', dot: '#3b82f6', chip: 'bg-blue-100 text-blue-800 border-blue-200' },
  pagado: { label: 'Pagado', dot: '#22c55e', chip: 'bg-green-100 text-green-800 border-green-200' },
  completado: { label: 'Completado', dot: '#10b981', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};
const statusMeta = (s) => STATUS_META[s] || { label: s || 'Sin estado', dot: '#a8a29e', chip: 'bg-stone-100 text-stone-700 border-stone-200' };

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Rango [inicio, fin] normalizado a medianoche local (fin >= inicio)
const tripInterval = (t) => {
  const s = parseLocalDate(t.start_date);
  let e = t.end_date ? parseLocalDate(t.end_date) : s;
  if (!e || (s && e < s)) e = s;
  return { s, e };
};

const tripUrl = (t) => createPageUrl(`SoldTripDetail?id=${t.id}`);
const tripTitle = (t) => t.client_name || t.trip_name || 'Viaje';

export default function TripCalendar() {
  const { viewMode } = useContext(ViewModeContext);
  const { user: clerkUser } = useSpoofableUser();

  const user = clerkUser ? {
    email: clerkUser.primaryEmailAddress?.emailAddress,
    role: clerkUser.publicMetadata?.role || 'user',
  } : null;

  const isAdmin = user?.role === 'admin' && viewMode === 'admin';

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState('month'); // 'month' | 'agenda'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPast, setShowPast] = useState(false);

  const { data: soldTrips = [], isLoading } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list('-created_date');
      const email = (user.email || '').toLowerCase();
      const owned = await supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
      const { data: shared } = await supabase
        .from('sold_trips')
        .select('*')
        .eq('is_deleted', false)
        .contains('metadata', { shared_with: [email] });
      const byId = new Map(owned.map(t => [t.id, t]));
      (shared || []).forEach(t => { if (!byId.has(t.id)) byId.set(t.id, t); });
      return Array.from(byId.values());
    },
    enabled: !!user,
    staleTime: 0,
  });

  const today = useMemo(() => startOfDay(new Date()), []);

  // Viajes con fecha, filtrados por búsqueda y estado
  const datedTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return soldTrips
      .filter(t => t.start_date)
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .filter(t => {
        if (!q) return true;
        return `${t.client_name || ''} ${t.destination || ''} ${t.trip_name || ''} ${t.file_number || ''}`
          .toLowerCase().includes(q);
      })
      .map(t => ({ trip: t, ...tripInterval(t) }))
      .filter(dt => dt.s); // descarta fechas inválidas
  }, [soldTrips, search, statusFilter]);

  // Etiqueta de cuenta regresiva
  const daysLabel = (dt) => {
    if (dt.s <= today && today <= dt.e) return { text: 'En curso', tone: 'text-emerald-600 bg-emerald-50' };
    const d = differenceInDays(dt.s, today);
    if (d === 0) return { text: 'Hoy', tone: 'text-red-600 bg-red-50' };
    if (d === 1) return { text: 'Mañana', tone: 'text-orange-600 bg-orange-50' };
    if (d > 1) return { text: `En ${d} días`, tone: d < 30 ? 'text-orange-600 bg-orange-50' : 'text-stone-600 bg-stone-100' };
    return { text: `Hace ${-d} día${d === -1 ? '' : 's'}`, tone: 'text-stone-400 bg-stone-100' };
  };

  // ---- Estadísticas de encabezado ----
  const stats = useMemo(() => {
    const upcoming = datedTrips.filter(dt => dt.e >= today);
    const next30 = upcoming.filter(dt => differenceInDays(dt.s, today) >= 0 && differenceInDays(dt.s, today) <= 30);
    const thisMonth = datedTrips.filter(dt => isSameMonth(dt.s, cursor) || (dt.s <= endOfMonth(cursor) && dt.e >= startOfMonth(cursor)));
    const nextTrip = [...upcoming].filter(dt => dt.e >= today).sort((a, b) => a.s - b.s)[0];
    return { upcomingCount: upcoming.length, next30: next30.length, thisMonth: thisMonth.length, nextTrip };
  }, [datedTrips, today, cursor]);

  // ---- Vista de mes ----
  const monthGrid = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const tripsForDay = (day) => datedTrips
    .filter(dt => day >= dt.s && day <= dt.e)
    .sort((a, b) => a.s - b.s);

  // ---- Vista de agenda ----
  const agenda = useMemo(() => {
    const sorted = [...datedTrips].sort((a, b) => a.s - b.s);
    return {
      upcoming: sorted.filter(dt => dt.e >= today),
      past: sorted.filter(dt => dt.e < today).reverse(),
    };
  }, [datedTrips, today]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
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

  const renderMonth = () => (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      {/* Navegación del mes */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h2 className="text-lg font-bold text-stone-800 capitalize">
          {formatDate(cursor, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCursor(startOfMonth(new Date()))}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Encabezado de días */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {WEEKDAYS.map(d => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-stone-400">{d}</div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7">
        {monthGrid.map((day, i) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const dayTrips = tripsForDay(day);
          const shown = dayTrips.slice(0, 3);
          const overflow = dayTrips.length - shown.length;
          return (
            <div
              key={i}
              className={`min-h-[92px] border-b border-r border-stone-100 p-1.5 flex flex-col gap-1 ${
                inMonth ? 'bg-white' : 'bg-stone-50/60'
              } ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
            >
              <span className={`text-[11px] font-semibold self-end w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? 'text-white' : inMonth ? 'text-stone-600' : 'text-stone-300'
              }`} style={isToday ? { backgroundColor: BRAND } : undefined}>
                {formatDate(day, 'd')}
              </span>
              <div className="flex flex-col gap-1 min-h-0">
                {shown.map(dt => {
                  const meta = statusMeta(dt.trip.status);
                  const isStart = isSameDay(day, dt.s);
                  const isWeekStart = day.getDay() === 1; // lunes
                  const label = isStart || isWeekStart;
                  return (
                    <Link
                      key={dt.trip.id}
                      to={tripUrl(dt.trip)}
                      title={`${tripTitle(dt.trip)}${dt.trip.destination ? ' · ' + dt.trip.destination : ''}`}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border truncate hover:opacity-80 ${meta.chip} ${
                        !isStart ? 'rounded-l-none border-l-0' : ''
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                      {label && <span className="truncate">{tripTitle(dt.trip)}</span>}
                    </Link>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[10px] text-stone-400 pl-1">+{overflow} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const AgendaRow = ({ dt, muted }) => {
    const meta = statusMeta(dt.trip.status);
    const lbl = daysLabel(dt);
    const sameDay = isSameDay(dt.s, dt.e);
    return (
      <Link
        to={tripUrl(dt.trip)}
        className={`flex items-center gap-3 px-4 py-3 border-t border-stone-100 hover:bg-stone-50 transition-colors ${muted ? 'opacity-70' : ''}`}
      >
        <div className="w-10 flex-shrink-0 text-center">
          <p className="text-lg font-bold leading-none text-stone-800">{formatDate(dt.s, 'd')}</p>
          <p className="text-[10px] uppercase text-stone-400">{formatDate(dt.s, 'MMM', { locale: es })}</p>
        </div>
        <span className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 truncate">{tripTitle(dt.trip)}</p>
          <p className="text-xs text-stone-400 truncate flex items-center gap-1">
            {dt.trip.destination && <><MapPin className="w-3 h-3" /> {dt.trip.destination} · </>}
            {formatDate(dt.s, 'd MMM', { locale: es })}
            {!sameDay && ` → ${formatDate(dt.e, 'd MMM', { locale: es })}`}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${lbl.tone}`}>{lbl.text}</span>
      </Link>
    );
  };

  const renderAgenda = () => (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
        <Plane className="w-4 h-4" style={{ color: BRAND }} />
        <h2 className="text-sm font-bold text-stone-800">Próximos viajes</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${BRAND}15`, color: BRAND }}>
          {agenda.upcoming.length}
        </span>
      </div>

      {agenda.upcoming.length === 0 ? (
        <div className="p-10 text-center text-stone-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 text-stone-200" />
          <p className="text-sm">No hay viajes próximos con estos filtros</p>
        </div>
      ) : (
        agenda.upcoming.map(dt => <AgendaRow key={dt.trip.id} dt={dt} />)
      )}

      {agenda.past.length > 0 && (
        <div className="border-t border-stone-100">
          <button
            onClick={() => setShowPast(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-stone-500 hover:bg-stone-50"
          >
            <Clock className="w-3.5 h-3.5" />
            {showPast ? 'Ocultar' : 'Mostrar'} viajes pasados ({agenda.past.length})
          </button>
          {showPast && agenda.past.map(dt => <AgendaRow key={dt.trip.id} dt={dt} muted />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Calendario de Viajes</h1>
          <p className="text-stone-400 text-sm">
            {stats.nextTrip
              ? <>Próximo: <strong>{tripTitle(stats.nextTrip.trip)}</strong> · {daysLabel(stats.nextTrip).text.toLowerCase()}</>
              : 'Programación de los viajes vendidos'}
          </p>
        </div>
        {/* Toggle de vista */}
        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 self-start">
          <button
            onClick={() => setView('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'month' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
            }`}
          >
            <CalendarDays className="w-4 h-4" /> Mes
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'agenda' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'
            }`}
          >
            <List className="w-4 h-4" /> Agenda
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Próximos" value={stats.upcomingCount} sub="viajes por venir" valueClass="text-stone-800" />
        <StatCard label="En 30 días" value={stats.next30} sub="empiezan pronto" valueClass="text-orange-600" />
        <StatCard label="Este mes" value={stats.thisMonth} sub={formatDate(cursor, 'MMMM', { locale: es })} valueClass="text-blue-600" />
        <StatCard
          label="Siguiente"
          value={stats.nextTrip ? daysLabel(stats.nextTrip).text : '—'}
          sub={stats.nextTrip ? tripTitle(stats.nextTrip.trip) : 'sin viajes'}
          valueClass="text-emerald-600"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Cliente, destino o expediente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-52 rounded-xl"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="parcial">Pago parcial</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === 'month' ? renderMonth() : renderAgenda()}

      {/* Leyenda de estados */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.dot }} />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
