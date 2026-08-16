import { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { parseLocalDate, formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Eye, CheckCircle2, Calendar, Columns3, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GREEN = '#2E442A';

const STAGE_LABELS = {
  nuevo: 'Nuevo', cotizando: 'Cotizando', propuesta_enviada: 'Propuesta enviada',
  aceptado: 'Aceptado', vendido: 'Vendido', perdido: 'Perdido',
};

// Tipos alineados con los que Corsario ya sabe mostrar
const SERVICE_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'vuelo', label: 'Vuelo' },
  { value: 'traslado', label: 'Traslado' },
  { value: 'tour', label: 'Tour' },
  { value: 'tren', label: 'Tren' },
  { value: 'crucero', label: 'Crucero' },
  { value: 'dmc', label: 'DMC' },
  { value: 'otro', label: 'Otro' },
];
const TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map((t) => [t.value, t.label]));
const DEFAULT_TYPES = ['hotel', 'vuelo', 'traslado', 'tour'];

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const flatten = (s) => ({ ...s, metadata: s.metadata || {}, price: s.price ?? s.total_price ?? 0 });
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const buildDays = (startStr, endStr) => {
  const s = parseLocalDate(startStr);
  const e = parseLocalDate(endStr);
  if (!s || !e || e < s) return [];
  const out = [];
  const cur = new Date(s);
  while (cur <= e && out.length < 400) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
};

export default function QuoteBuilder() {
  const tripId = new URLSearchParams(window.location.search).get('trip_id');
  const { user } = useUser();

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['quote-trip', tripId],
    queryFn: () => supabaseAPI.entities.Trip.filter({ id: tripId }).then((r) => r[0]),
    enabled: !!tripId,
  });
  const tripRef = useRef(trip);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  const { data: loadedServices, isLoading: svcLoading, isError: svcError } = useQuery({
    queryKey: ['quote-services', tripId],
    queryFn: async () => {
      const raw = await supabaseAPI.entities.TripService.filter({ trip_id: tripId });
      return raw.map(flatten);
    },
    enabled: !!tripId, refetchOnWindowFocus: false, retry: false,
  });

  // ---- estado local editable ----
  const [services, setServices] = useState([]);
  const servicesRef = useRef(services);
  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { if (loadedServices) setServices(loadedServices); }, [loadedServices]);

  // rango de fechas (genera las filas por día)
  const [range, setRange] = useState({ start: '', end: '' });
  useEffect(() => { if (trip) setRange({ start: trip.start_date || '', end: trip.end_date || '' }); }, [trip]);

  // info por día (De/A, Actividad) → vive en trip.metadata.days
  const [dayInfo, setDayInfo] = useState({});
  const dayInfoRef = useRef(dayInfo);
  useEffect(() => { dayInfoRef.current = dayInfo; }, [dayInfo]);
  useEffect(() => { if (trip) setDayInfo(trip.metadata?.days || {}); }, [trip]);

  // columnas visibles
  const [visibleTypes, setVisibleTypes] = useState(DEFAULT_TYPES);
  const [colMenu, setColMenu] = useState(false);
  useEffect(() => {
    if (!loadedServices) return;
    const used = new Set(loadedServices.map((s) => s.service_type).filter(Boolean));
    setVisibleTypes((prev) => {
      const set = new Set(prev);
      used.forEach((t) => set.add(t));
      return SERVICE_TYPES.map((t) => t.value).filter((v) => set.has(v));
    });
  }, [loadedServices]);

  const days = useMemo(() => buildDays(range.start, range.end), [range.start, range.end]);

  // índice: (día|tipo) -> servicios
  const byKey = useMemo(() => {
    const map = {};
    services.forEach((s) => {
      const k = `${s.start_date || 'sin'}|${s.service_type}`;
      (map[k] = map[k] || []).push(s);
    });
    return map;
  }, [services]);

  const totalsByType = useMemo(() => {
    const m = {};
    services.forEach((s) => { m[s.service_type] = (m[s.service_type] || 0) + (parseFloat(s.price) || 0); });
    return m;
  }, [services]);
  const grandTotal = useMemo(() => services.reduce((a, s) => a + (parseFloat(s.price) || 0), 0), [services]);

  // ---- persistencia ----
  const persist = (id, patch) =>
    supabaseAPI.entities.TripService.update(id, patch).catch(() => toast.error('No se pudo guardar'));
  const setSvcLocal = (id, updater) => setServices((rs) => rs.map((r) => (r.id === id ? updater(r) : r)));
  const saveSvcField = (id, field) => {
    const r = servicesRef.current.find((x) => x.id === id);
    if (!r) return;
    let val = r[field];
    if (field === 'price') val = parseFloat(val) || 0;
    persist(id, { [field]: val });
  };

  const addService = async (dayKey, type) => {
    try {
      const created = await supabaseAPI.entities.TripService.create({
        trip_id: tripId, service_type: type, service_name: '', price: 0, commission: 0,
        start_date: dayKey, metadata: {},
        ...(user?.primaryEmailAddress?.emailAddress ? { created_by: user.primaryEmailAddress.emailAddress } : {}),
      });
      setServices((rs) => [...rs, flatten(created)]);
    } catch {
      toast.error('No se pudo agregar (¿ya corriste la migración del Cotizador?)');
    }
  };
  const deleteService = async (id) => {
    const prev = servicesRef.current;
    setServices((rs) => rs.filter((r) => r.id !== id));
    try { await supabaseAPI.entities.TripService.delete(id); }
    catch { toast.error('No se pudo eliminar'); setServices(prev); }
  };

  const setDayLocal = (dayKey, field, value) =>
    setDayInfo((di) => ({ ...di, [dayKey]: { ...(di[dayKey] || {}), [field]: value } }));
  const saveDay = (dayKey) => {
    const meta = { ...(tripRef.current?.metadata || {}) };
    meta.days = { ...(meta.days || {}), [dayKey]: dayInfoRef.current[dayKey] || {} };
    supabaseAPI.entities.Trip.update(tripId, { metadata: meta }).catch(() => toast.error('No se pudo guardar el día'));
  };

  const saveRange = async (next) => {
    setRange(next);
    try { await supabaseAPI.entities.Trip.update(tripId, { start_date: next.start || null, end_date: next.end || null }); }
    catch { toast.error('No se pudieron guardar las fechas'); }
  };

  const toggleType = (t) =>
    setVisibleTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : SERVICE_TYPES.map((s) => s.value).filter((v) => prev.includes(v) || v === t)));

  // ---- guards ----
  if (!tripId) return <div className="min-h-screen flex items-center justify-center text-stone-500">Falta el parámetro trip_id.</div>;
  if (tripLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} /></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center text-stone-500">Cotización no encontrada.</div>;

  const inputCls = 'w-full bg-transparent text-sm text-stone-800 outline-none rounded px-1.5 py-1 focus:bg-blue-50/70 focus:ring-1 focus:ring-blue-300';
  const cellName = 'w-full bg-transparent text-xs font-medium text-stone-800 outline-none rounded px-1 py-0.5 focus:bg-blue-50/70';
  const cellPrice = 'w-full bg-transparent text-sm font-bold text-stone-800 text-right tabular-nums outline-none rounded px-1 py-0.5 focus:bg-blue-50/70';

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Barra superior */}
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => window.close()} title="Cerrar pestaña">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-800 truncate">{trip.trip_name || trip.destination || 'Cotización'}</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                {STAGE_LABELS[trip.stage] || trip.stage || '—'}
              </span>
            </div>
            <p className="text-xs text-stone-400 truncate">{trip.client_name}{trip.destination ? ` · ${trip.destination}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" disabled title="En el siguiente paso">
              <Eye className="w-4 h-4 mr-1.5" /> Preview cliente
            </Button>
            <Button className="rounded-xl text-white" style={{ backgroundColor: GREEN }} disabled title="En el siguiente paso">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Vender viaje
            </Button>
          </div>
        </div>
      </header>

      {/* Rango de fechas + columnas */}
      <div className="max-w-[1400px] mx-auto w-full px-5 pt-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4" style={{ color: GREEN }} />
          <input type="date" value={range.start || ''} onChange={(e) => saveRange({ ...range, start: e.target.value })}
            className="text-sm text-stone-700 bg-transparent outline-none" />
          <span className="text-stone-400">→</span>
          <input type="date" value={range.end || ''} onChange={(e) => saveRange({ ...range, end: e.target.value })}
            className="text-sm text-stone-700 bg-transparent outline-none" />
        </div>
        <span className="text-xs text-stone-500">
          {days.length > 0 ? `${days.length} día${days.length !== 1 ? 's' : ''} · las filas se crean solas` : 'Pon las fechas del viaje para generar los días'}
        </span>
        <span className="flex-1" />
        <div className="relative">
          <button onClick={() => setColMenu((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 border border-stone-200 bg-white rounded-lg px-3 py-2 hover:bg-stone-50">
            <Columns3 className="w-4 h-4" /> Columnas
          </button>
          {colMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-xl shadow-lg z-30 p-1">
              {SERVICE_TYPES.map((t) => {
                const on = visibleTypes.includes(t.value);
                return (
                  <button key={t.value} onClick={() => toggleType(t.value)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-stone-700 rounded-lg hover:bg-stone-50">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-stone-800 border-stone-800' : 'border-stone-300'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Itinerario */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-5 py-4">
          {svcError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No se pudieron cargar los servicios. Si es la primera vez, falta correr la <strong>migración del Cotizador</strong> en Supabase (columna <code>trip_id</code>).
            </div>
          )}

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="bg-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    <th className="w-9 px-2 py-2.5 text-left">#</th>
                    <th className="w-28 px-2 py-2.5 text-left">Fecha</th>
                    <th className="w-32 px-2 py-2.5 text-left">De / A</th>
                    <th className="w-56 px-2 py-2.5 text-left">Actividad</th>
                    {visibleTypes.map((t) => <th key={t} className="w-40 px-2 py-2.5 text-left">{TYPE_LABEL[t]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const key = toKey(d);
                    const info = dayInfo[key] || {};
                    return (
                      <tr key={key} className="border-t border-stone-100 align-top hover:bg-stone-50/40">
                        <td className="px-2 py-1.5 text-stone-400 text-sm tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5 text-xs text-stone-500 whitespace-nowrap">{formatDate(d, 'EEE d MMM', { locale: es })}</td>
                        <td className="px-1 py-1.5">
                          <input className={inputCls} placeholder="Tokyo → Hakone"
                            value={info.route || ''}
                            onChange={(e) => setDayLocal(key, 'route', e.target.value)}
                            onBlur={() => saveDay(key)} />
                        </td>
                        <td className="px-1 py-1.5">
                          <input className={inputCls} placeholder="Actividad del día…"
                            value={info.activity || ''}
                            onChange={(e) => setDayLocal(key, 'activity', e.target.value)}
                            onBlur={() => saveDay(key)} />
                        </td>
                        {visibleTypes.map((t) => {
                          const cell = byKey[`${key}|${t}`] || [];
                          return (
                            <td key={t} className="px-1.5 py-1.5">
                              <div className="space-y-1">
                                {cell.map((s) => (
                                  <div key={s.id} className="group/svc rounded-lg border border-stone-100 bg-stone-50/60 px-1.5 py-1">
                                    <div className="flex items-start gap-1">
                                      <input className={cellName} placeholder="Nombre…"
                                        value={s.service_name || ''}
                                        onChange={(e) => setSvcLocal(s.id, (r) => ({ ...r, service_name: e.target.value }))}
                                        onBlur={() => saveSvcField(s.id, 'service_name')} />
                                      <button onClick={() => deleteService(s.id)} title="Eliminar"
                                        className="opacity-0 group-hover/svc:opacity-100 p-0.5 rounded text-stone-300 hover:text-red-600">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <input type="number" step="0.01" min="0" placeholder="$0" className={cellPrice}
                                      value={s.price ?? 0}
                                      onChange={(e) => setSvcLocal(s.id, (r) => ({ ...r, price: e.target.value }))}
                                      onBlur={() => saveSvcField(s.id, 'price')} />
                                  </div>
                                ))}
                                <button onClick={() => addService(key, t)}
                                  className="w-full flex items-center justify-center gap-1 text-[11px] text-stone-300 hover:text-stone-600 rounded-lg border border-dashed border-stone-200 hover:border-stone-300 py-1 transition-colors">
                                  <Plus className="w-3 h-3" /> {cell.length === 0 ? TYPE_LABEL[t] : ''}
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {days.length === 0 && !svcLoading && (
                    <tr><td colSpan={4 + visibleTypes.length} className="px-4 py-10 text-center text-stone-400 text-sm">
                      Pon las <strong>fechas del viaje</strong> arriba para generar el itinerario.
                    </td></tr>
                  )}
                </tbody>
                {days.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-50 border-t-2 border-stone-200 font-bold text-stone-700 text-sm">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-stone-400">Totales por tipo</td>
                      {visibleTypes.map((t) => <td key={t} className="px-2 py-2.5 tabular-nums">{money(totalsByType[t] || 0)}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <div className="rounded-xl px-5 py-2.5 text-white font-bold flex items-center gap-3" style={{ backgroundColor: GREEN }}>
              <span className="text-[11px] font-semibold opacity-80 uppercase tracking-wider">Total del viaje</span>
              <span className="text-lg tabular-nums">{money(grandTotal)}</span>
            </div>
          </div>

          <p className="text-xs text-stone-400 mt-3">
            Se guarda automáticamente. Siguiente paso: panel de detalle por servicio (proveedor, noches, habitación…), preview del cliente y el botón Vender.
          </p>
        </div>
      </main>
    </div>
  );
}
