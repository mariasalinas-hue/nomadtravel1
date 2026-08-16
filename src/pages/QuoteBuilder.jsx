import { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { parseLocalDate, formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Eye, CheckCircle2, Calendar, Columns3, Plus, Trash2, Check, GripVertical, Maximize2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import CityPicker from '@/components/quote/CityPicker';
import ServiceDetailPanel from '@/components/quote/ServiceDetailPanel';

const GREEN = '#2E442A';

const STAGE_LABELS = {
  nuevo: 'Nuevo', cotizando: 'Cotizando', propuesta_enviada: 'Propuesta enviada',
  aceptado: 'Aceptado', vendido: 'Vendido', perdido: 'Perdido',
};

const SERVICE_TYPES = [
  { value: 'hotel', label: 'Hotel' }, { value: 'vuelo', label: 'Vuelo' },
  { value: 'traslado', label: 'Traslado' }, { value: 'tour', label: 'Tour' },
  { value: 'tren', label: 'Tren' }, { value: 'crucero', label: 'Crucero' },
  { value: 'dmc', label: 'DMC' }, { value: 'otro', label: 'Otro' },
];
const TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map((t) => [t.value, t.label]));
const ALL_TYPES = SERVICE_TYPES.map((t) => t.value);
const DEFAULT_TYPES = ['hotel', 'vuelo', 'traslado', 'tour'];

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
const flatten = (s) => ({ ...s, metadata: s.metadata || {}, price: s.price ?? s.total_price ?? 0 });
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDateStr = (str, delta) => { const d = parseLocalDate(str); if (!d) return str; d.setDate(d.getDate() + delta); return toKey(d); };

const buildDays = (startStr, endStr) => {
  const s = parseLocalDate(startStr); const e = parseLocalDate(endStr);
  if (!s || !e || e < s) return [];
  const out = []; const cur = new Date(s);
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
    queryFn: async () => (await supabaseAPI.entities.TripService.filter({ trip_id: tripId })).map(flatten),
    enabled: !!tripId, refetchOnWindowFocus: false, retry: false,
  });

  const [services, setServices] = useState([]);
  const servicesRef = useRef(services);
  useEffect(() => { servicesRef.current = services; }, [services]);
  useEffect(() => { if (loadedServices) setServices(loadedServices); }, [loadedServices]);

  const [range, setRange] = useState({ start: '', end: '' });
  useEffect(() => { if (trip) setRange({ start: trip.start_date || '', end: trip.end_date || '' }); }, [trip]);

  const [dayInfo, setDayInfo] = useState({});
  const dayInfoRef = useRef(dayInfo);
  useEffect(() => { dayInfoRef.current = dayInfo; }, [dayInfo]);
  useEffect(() => { if (trip) setDayInfo(trip.metadata?.days || {}); }, [trip]);

  const [visibleTypes, setVisibleTypes] = useState(DEFAULT_TYPES);
  const [colMenu, setColMenu] = useState(false);
  useEffect(() => {
    if (!loadedServices) return;
    const used = new Set(loadedServices.map((s) => s.service_type).filter(Boolean));
    setVisibleTypes((prev) => { const set = new Set(prev); used.forEach((t) => set.add(t)); return ALL_TYPES.filter((v) => set.has(v)); });
  }, [loadedServices]);

  const days = useMemo(() => buildDays(range.start, range.end), [range.start, range.end]);
  const byKey = useMemo(() => {
    const map = {};
    services.forEach((s) => { const k = `${s.start_date || 'sin'}|${s.service_type}`; (map[k] = map[k] || []).push(s); });
    return map;
  }, [services]);
  const totalsByType = useMemo(() => {
    const m = {}; services.forEach((s) => { m[s.service_type] = (m[s.service_type] || 0) + (parseFloat(s.price) || 0); }); return m;
  }, [services]);
  const grandTotal = useMemo(() => services.reduce((a, s) => a + (parseFloat(s.price) || 0), 0), [services]);

  // ---- persistencia servicios ----
  const persistSvc = (id, patch) => supabaseAPI.entities.TripService.update(id, patch).catch(() => toast.error('No se pudo guardar'));
  const setSvcLocal = (id, updater) => setServices((rs) => rs.map((r) => (r.id === id ? updater(r) : r)));
  const saveSvcField = (id, field) => {
    const r = servicesRef.current.find((x) => x.id === id); if (!r) return;
    let val = r[field]; if (field === 'price') val = parseFloat(val) || 0;
    persistSvc(id, { [field]: val });
  };
  const addService = async (dayKey, type) => {
    try {
      const created = await supabaseAPI.entities.TripService.create({
        trip_id: tripId, service_type: type, service_name: '', price: 0, commission: 0, start_date: dayKey, metadata: {},
        ...(user?.primaryEmailAddress?.emailAddress ? { created_by: user.primaryEmailAddress.emailAddress } : {}),
      });
      setServices((rs) => [...rs, flatten(created)]);
    } catch { toast.error('No se pudo agregar (¿ya corriste la migración del Cotizador?)'); }
  };
  const deleteService = async (id) => {
    const prev = servicesRef.current;
    setServices((rs) => rs.filter((r) => r.id !== id));
    try { await supabaseAPI.entities.TripService.delete(id); } catch { toast.error('No se pudo eliminar'); setServices(prev); }
  };

  // ---- panel de detalle ----
  const [panelId, setPanelId] = useState(null);
  const panelService = services.find((s) => s.id === panelId) || null;
  const setPanelLocal = (id, field, value, meta) =>
    setSvcLocal(id, (r) => (meta ? { ...r, metadata: { ...r.metadata, [field]: value } } : { ...r, [field]: value }));
  const persistNow = (id, field, value, meta) => {
    if (meta) {
      const r = servicesRef.current.find((x) => x.id === id);
      persistSvc(id, { metadata: { ...(r?.metadata || {}), [field]: value } });
    } else {
      const val = field === 'price' || field === 'commission' ? parseFloat(value) || 0 : value;
      persistSvc(id, { [field]: val });
    }
  };
  const onPanelSet = (field, value, meta, persist) => {
    if (!panelId) return;
    setPanelLocal(panelId, field, value, meta);
    if (persist) persistNow(panelId, field, value, meta);
  };

  // ---- persistencia viaje (fechas + info por día) ----
  const persistTrip = (patch) => supabaseAPI.entities.Trip.update(tripId, patch).catch(() => toast.error('No se pudo guardar'));
  const setDayLocal = (dayKey, field, value) => setDayInfo((di) => ({ ...di, [dayKey]: { ...(di[dayKey] || {}), [field]: value } }));
  const saveDayNow = (dayKey, patch) => {
    const nextDays = { ...dayInfoRef.current, [dayKey]: { ...(dayInfoRef.current[dayKey] || {}), ...patch } };
    persistTrip({ metadata: { ...(tripRef.current?.metadata || {}), days: nextDays } });
  };
  const saveRange = (next) => {
    setRange(next);
    persistTrip({ start_date: next.start || null, end_date: next.end || null });
  };

  // ---- insertar / quitar día (recorre las fechas) ----
  const insertDayAt = (index) => {
    if (!days[index]) return;
    const from = toKey(days[index]);
    const changed = [];
    const nextServices = servicesRef.current.map((s) => {
      if (s.start_date && s.start_date >= from) { const nd = shiftDateStr(s.start_date, 1); changed.push([s.id, nd]); return { ...s, start_date: nd }; }
      return s;
    });
    setServices(nextServices);
    changed.forEach(([id, nd]) => persistSvc(id, { start_date: nd }));
    const nextDays = {};
    Object.entries(dayInfoRef.current).forEach(([k, v]) => { nextDays[k >= from ? shiftDateStr(k, 1) : k] = v; });
    setDayInfo(nextDays);
    const newEnd = shiftDateStr(range.end, 1);
    setRange((r) => ({ ...r, end: newEnd }));
    persistTrip({ end_date: newEnd, metadata: { ...(tripRef.current?.metadata || {}), days: nextDays } });
  };
  const removeDayAt = (index) => {
    if (!days[index]) return;
    const del = toKey(days[index]);
    const onDay = servicesRef.current.filter((s) => s.start_date === del);
    if (onDay.length && !window.confirm(`Este día tiene ${onDay.length} servicio(s). ¿Quitar el día y borrarlos?`)) return;
    onDay.forEach((s) => supabaseAPI.entities.TripService.delete(s.id).catch(() => {}));
    const changed = [];
    const nextServices = servicesRef.current.filter((s) => s.start_date !== del).map((s) => {
      if (s.start_date && s.start_date > del) { const nd = shiftDateStr(s.start_date, -1); changed.push([s.id, nd]); return { ...s, start_date: nd }; }
      return s;
    });
    setServices(nextServices);
    changed.forEach(([id, nd]) => persistSvc(id, { start_date: nd }));
    const nextDays = {};
    Object.entries(dayInfoRef.current).forEach(([k, v]) => { if (k === del) return; nextDays[k > del ? shiftDateStr(k, -1) : k] = v; });
    setDayInfo(nextDays);
    const newEnd = shiftDateStr(range.end, -1);
    setRange((r) => ({ ...r, end: newEnd }));
    persistTrip({ end_date: newEnd, metadata: { ...(tripRef.current?.metadata || {}), days: nextDays } });
  };

  const toggleType = (t) => setVisibleTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : ALL_TYPES.filter((v) => prev.includes(v) || v === t)));

  // ---- arrastrar servicios entre días (mismo tipo) ----
  const [draggingType, setDraggingType] = useState(null);
  const onDragStart = (start) => setDraggingType(start.source.droppableId.split('|')[1]);
  const onDragEnd = (result) => {
    setDraggingType(null);
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const [srcDay, srcType] = source.droppableId.split('|');
    const [destDay, destType] = destination.droppableId.split('|');
    if (srcType !== destType || srcDay === destDay) return; // solo mover de día, mismo tipo
    setSvcLocal(draggableId, (r) => ({ ...r, start_date: destDay }));
    persistSvc(draggableId, { start_date: destDay });
  };

  if (!tripId) return <div className="min-h-screen flex items-center justify-center text-stone-500">Falta el parámetro trip_id.</div>;
  if (tripLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} /></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center text-stone-500">Cotización no encontrada.</div>;

  const inputCls = 'w-full bg-transparent text-sm text-stone-800 outline-none rounded px-1.5 py-1 focus:bg-blue-50/70 focus:ring-1 focus:ring-blue-300';
  const cellName = 'w-full bg-transparent text-xs font-medium text-stone-800 outline-none rounded px-1 py-0.5 focus:bg-blue-50/70';
  const cellPrice = 'w-full bg-transparent text-sm font-bold text-stone-800 text-right tabular-nums outline-none rounded px-1 py-0.5 focus:bg-blue-50/70';
  const nonTypeCols = 5;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => window.close()} title="Cerrar pestaña">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-800 truncate">{trip.trip_name || trip.destination || 'Cotización'}</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">{STAGE_LABELS[trip.stage] || trip.stage || '—'}</span>
            </div>
            <p className="text-xs text-stone-400 truncate">{trip.client_name}{trip.destination ? ` · ${trip.destination}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" disabled title="En el siguiente paso"><Eye className="w-4 h-4 mr-1.5" /> Preview cliente</Button>
            <Button className="rounded-xl text-white" style={{ backgroundColor: GREEN }} disabled title="En el siguiente paso"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Vender viaje</Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto w-full px-5 pt-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4" style={{ color: GREEN }} />
          <input type="date" value={range.start || ''} onChange={(e) => saveRange({ ...range, start: e.target.value })} className="text-sm text-stone-700 bg-transparent outline-none" />
          <span className="text-stone-400">→</span>
          <input type="date" value={range.end || ''} onChange={(e) => saveRange({ ...range, end: e.target.value })} className="text-sm text-stone-700 bg-transparent outline-none" />
        </div>
        <span className="text-xs text-stone-500">{days.length > 0 ? `${days.length} día${days.length !== 1 ? 's' : ''} · las filas se crean solas` : 'Pon las fechas del viaje para generar los días'}</span>
        <span className="flex-1" />
        <div className="relative">
          <button onClick={() => setColMenu((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 border border-stone-200 bg-white rounded-lg px-3 py-2 hover:bg-stone-50"><Columns3 className="w-4 h-4" /> Columnas</button>
          {colMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-xl shadow-lg z-30 p-1">
              {SERVICE_TYPES.map((t) => {
                const on = visibleTypes.includes(t.value);
                return (
                  <button key={t.value} onClick={() => toggleType(t.value)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-stone-700 rounded-lg hover:bg-stone-50">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-stone-800 border-stone-800' : 'border-stone-300'}`}>{on && <Check className="w-3 h-3 text-white" />}</span>{t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-5 py-4">
          {svcError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No se pudieron cargar los servicios. Si es la primera vez, falta correr la <strong>migración del Cotizador</strong> en Supabase (columna <code>trip_id</code>).
            </div>
          )}

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <table className="w-full border-collapse" style={{ minWidth: 960 }}>
                <thead>
                  <tr className="bg-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    <th className="w-7 px-1 py-2.5"></th>
                    <th className="w-8 px-2 py-2.5 text-left">#</th>
                    <th className="w-24 px-2 py-2.5 text-left">Fecha</th>
                    <th className="w-44 px-2 py-2.5 text-left">Ciudad</th>
                    <th className="w-56 px-2 py-2.5 text-left">Actividad</th>
                    {visibleTypes.map((t) => <th key={t} className="w-40 px-2 py-2.5 text-left">{TYPE_LABEL[t]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const key = toKey(d);
                    const info = dayInfo[key] || {};
                    return (
                      <tr key={key} className="group border-t border-stone-100 align-top hover:bg-stone-50/40">
                        <td className="px-1 py-1.5">
                          <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => insertDayAt(i)} title="Insertar día antes" className="p-0.5 rounded text-stone-300 hover:text-emerald-600"><Plus className="w-3.5 h-3.5" /></button>
                            <button onClick={() => removeDayAt(i)} title="Quitar este día" className="p-0.5 rounded text-stone-300 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-stone-400 text-sm tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5 text-xs text-stone-500 whitespace-nowrap">{formatDate(d, 'EEE d MMM', { locale: es })}</td>
                        <td className="px-1 py-1.5">
                          <CityPicker value={info.city || ''} onChange={(city) => { setDayLocal(key, 'city', city); saveDayNow(key, { city }); }} />
                        </td>
                        <td className="px-1 py-1.5">
                          <input className={inputCls} placeholder="Actividad del día…" value={info.activity || ''}
                            onChange={(e) => setDayLocal(key, 'activity', e.target.value)} onBlur={(e) => saveDayNow(key, { activity: e.target.value })} />
                        </td>
                        {visibleTypes.map((t) => {
                          const cell = byKey[`${key}|${t}`] || [];
                          return (
                            <td key={t} className="px-1.5 py-1.5">
                              <Droppable droppableId={`${key}|${t}`} isDropDisabled={!!draggingType && draggingType !== t}>
                                {(prov, snap) => (
                                  <div ref={prov.innerRef} {...prov.droppableProps}
                                    className={`space-y-1 rounded-lg transition-colors ${snap.isDraggingOver ? 'ring-2 ring-emerald-300 bg-emerald-50/50' : ''}`}>
                                    {cell.map((s, idx) => (
                                      <Draggable key={s.id} draggableId={s.id} index={idx}>
                                        {(dp) => (
                                          <div ref={dp.innerRef} {...dp.draggableProps} className="group/svc rounded-lg border border-stone-100 bg-stone-50/60 px-1.5 py-1">
                                            <div className="flex items-start gap-1">
                                              <span {...dp.dragHandleProps} className="mt-0.5 text-stone-300 hover:text-stone-500 cursor-grab" title="Arrastrar a otro día">
                                                <GripVertical className="w-3 h-3" />
                                              </span>
                                              <input className={cellName} placeholder="Nombre…" value={s.service_name || ''}
                                                onChange={(e) => setSvcLocal(s.id, (r) => ({ ...r, service_name: e.target.value }))} onBlur={() => saveSvcField(s.id, 'service_name')} />
                                              <button onClick={() => setPanelId(s.id)} title="Ver detalle" className="opacity-0 group-hover/svc:opacity-100 p-0.5 rounded text-stone-300 hover:text-stone-700"><Maximize2 className="w-3 h-3" /></button>
                                              <button onClick={() => deleteService(s.id)} title="Eliminar" className="opacity-0 group-hover/svc:opacity-100 p-0.5 rounded text-stone-300 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                            <input type="number" step="0.01" min="0" placeholder="$0" className={cellPrice} value={s.price ?? 0}
                                              onChange={(e) => setSvcLocal(s.id, (r) => ({ ...r, price: e.target.value }))} onBlur={() => saveSvcField(s.id, 'price')} />
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {prov.placeholder}
                                    <button onClick={() => addService(key, t)} className="w-full flex items-center justify-center gap-1 text-[11px] text-stone-300 hover:text-stone-600 rounded-lg border border-dashed border-stone-200 hover:border-stone-300 py-1 transition-colors">
                                      <Plus className="w-3 h-3" /> {cell.length === 0 ? TYPE_LABEL[t] : ''}
                                    </button>
                                  </div>
                                )}
                              </Droppable>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {days.length === 0 && !svcLoading && (
                    <tr><td colSpan={nonTypeCols + visibleTypes.length} className="px-4 py-10 text-center text-stone-400 text-sm">Pon las <strong>fechas del viaje</strong> arriba para generar el itinerario.</td></tr>
                  )}
                </tbody>
                {days.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-50 border-t-2 border-stone-200 font-bold text-stone-700 text-sm">
                      <td colSpan={nonTypeCols} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-stone-400">Totales por tipo</td>
                      {visibleTypes.map((t) => <td key={t} className="px-2 py-2.5 tabular-nums">{money(totalsByType[t] || 0)}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
              </DragDropContext>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <div className="rounded-xl px-5 py-2.5 text-white font-bold flex items-center gap-3" style={{ backgroundColor: GREEN }}>
              <span className="text-[11px] font-semibold opacity-80 uppercase tracking-wider">Total del viaje</span>
              <span className="text-lg tabular-nums">{money(grandTotal)}</span>
            </div>
          </div>

          <p className="text-xs text-stone-400 mt-3">Se guarda automáticamente. Pasa el mouse sobre una fila para <strong>insertar</strong> o <strong>quitar un día</strong> (las fechas se recorren solas). Siguiente: arrastrar servicios entre días, panel de detalle, preview y Vender.</p>
        </div>
      </main>

      <ServiceDetailPanel
        service={panelService}
        onSet={onPanelSet}
        onDelete={() => { if (panelId) { deleteService(panelId); setPanelId(null); } }}
        onClose={() => setPanelId(null)}
      />
    </div>
  );
}
