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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BRAND = '#2D4629';
const GOLD = '#C9A84C';

// Colores por estado del viaje (mismos estados que Viajes Vendidos)
// bar   = pastilla suave con etiqueta (día de inicio / inicio de semana)
// track = barra fina de continuación en los días intermedios
const STATUS_META = {
  pendiente:  { label: 'Pendiente',    dot: '#EAB308', bar: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70',     track: 'bg-amber-300/70' },
  parcial:    { label: 'Pago parcial', dot: '#3B82F6', bar: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',        track: 'bg-blue-300/70' },
  pagado:     { label: 'Pagado',       dot: '#22C55E', bar: 'bg-green-50 text-green-700 ring-1 ring-green-200/70',     track: 'bg-green-300/70' },
  completado: { label: 'Completado',   dot: '#10B981', bar: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70', track: 'bg-emerald-300/70' },
};
const statusMeta = (s) => STATUS_META[s] || { label: s || 'Sin estado', dot: '#A8A29E', bar: 'bg-stone-100 text-stone-600 ring-1 ring-stone-200/70', track: 'bg-stone-300/70' };

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

  const StatCard = ({ label, value, sub, valueClass = 'text-stone-800', accent }) => (
    <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
      <div className="flex items-center gap-1.5">
        {accent && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold mt-1.5 ${valueClass}`} style={{ letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs text-stone-400 mt-0.5 truncate">{sub}</p>
    </div>
  );

  const renderMonth = () => (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      {/* Navegación del mes */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-2xl font-bold text-stone-800 capitalize" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.01em' }}>
          {formatDate(cursor, 'MMMM', { locale: es })}
          <span className="text-stone-300 font-normal ml-2">{formatDate(cursor, 'yyyy')}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCursor(subMonths(cursor, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-4 h-9 rounded-full border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-800 transition-colors">
            Hoy
          </button>
          <button onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Encabezado de días */}
      <div className="grid grid-cols-7 bg-stone-50/60 border-b border-stone-100">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] ${i >= 5 ? 'text-stone-300' : 'text-stone-400'}`}>{d}</div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7">
        {monthGrid.map((day, i) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const dayTrips = tripsForDay(day);
          const shown = dayTrips.slice(0, 3);
          const overflow = dayTrips.length - shown.length;
          return (
            <div
              key={i}
              className={`min-h-[104px] border-b border-r border-stone-100/80 px-1.5 pt-1.5 pb-2 flex flex-col gap-1 transition-colors ${
                !inMonth ? 'bg-stone-50/50' : isWeekend ? 'bg-stone-50/30' : 'bg-white'
              } ${(i + 1) % 7 === 0 ? 'border-r-0' : ''} ${i >= monthGrid.length - 7 ? 'border-b-0' : ''}`}
            >
              <span className={`text-[11px] font-semibold self-end w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? 'text-white shadow-sm' : inMonth ? 'text-stone-500' : 'text-stone-300'
              }`} style={isToday ? { backgroundColor: BRAND } : undefined}>
                {formatDate(day, 'd')}
              </span>
              <div className="flex flex-col gap-1 min-h-0">
                {shown.map(dt => {
                  const meta = statusMeta(dt.trip.status);
                  const isStart = isSameDay(day, dt.s);
                  const isWeekStart = day.getDay() === 1; // lunes
                  const withLabel = isStart || isWeekStart;
                  const title = `${tripTitle(dt.trip)}${dt.trip.destination ? ' · ' + dt.trip.destination : ''}`;
                  return withLabel ? (
                    <Link
                      key={dt.trip.id}
                      to={tripUrl(dt.trip)}
                      title={title}
                      className={`flex items-center gap-1 h-[19px] px-1.5 rounded-md text-[11px] font-medium leading-none truncate transition-transform hover:-translate-y-px ${meta.bar}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                      <span className="truncate">{tripTitle(dt.trip)}</span>
                    </Link>
                  ) : (
                    <Link
                      key={dt.trip.id}
                      to={tripUrl(dt.trip)}
                      title={title}
                      className="h-[19px] flex items-center px-0.5"
                    >
                      <span className={`w-full h-1.5 rounded-full ${meta.track}`} />
                    </Link>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[10px] font-medium text-stone-400 pl-1.5">+{overflow} más</span>
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
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <Plane className="w-4 h-4" style={{ color: BRAND }} />
        <h2 className="text-base font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>Próximos viajes</h2>
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
          <h1 className="text-3xl lg:text-4xl font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '-0.02em' }}>
            Calendario de Viajes
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {stats.nextTrip
              ? <>Próximo: <strong className="text-stone-700">{tripTitle(stats.nextTrip.trip)}</strong> · {daysLabel(stats.nextTrip).text.toLowerCase()}</>
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
        <StatCard label="Próximos" value={stats.upcomingCount} sub="viajes por venir" valueClass="text-stone-800" accent={BRAND} />
        <StatCard label="En 30 días" value={stats.next30} sub="empiezan pronto" valueClass="text-orange-600" accent="#F97316" />
        <StatCard label="Este mes" value={stats.thisMonth} sub={formatDate(cursor, 'MMMM', { locale: es })} valueClass="text-blue-600" accent="#3B82F6" />
        <StatCard
          label="Siguiente"
          value={stats.nextTrip ? daysLabel(stats.nextTrip).text : '—'}
          sub={stats.nextTrip ? tripTitle(stats.nextTrip.trip) : 'sin viajes'}
          valueClass="text-stone-800"
          accent={GOLD}
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Estado</span>
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
