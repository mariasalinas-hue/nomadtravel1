import { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { parseLocalDate, formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Eye, CheckCircle2, Calendar, Columns3, Plus, Trash2, Check, GripVertical, Maximize2, Plane, PlaneLanding } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import CityPicker from '@/components/quote/CityPicker';
import ServiceDetailPanel from '@/components/quote/ServiceDetailPanel';
import ServiceEditor from '@/components/quote/ServiceEditor';
import { pricingView, applyTotal, applyType } from '@/lib/quotePricing';

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
// Un servicio "con contenido" es el que ya tiene nombre o algún monto. Las filas
// vacías (creadas con "+ Tipo" pero sin llenar) no cuentan como servicios reales.
const hasContent = (s) => !!(s.service_name && s.service_name.trim()) || Number(s.price) > 0 || Number(s.commission) > 0;
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDateStr = (str, delta) => { const d = parseLocalDate(str); if (!d) return str; d.setDate(d.getDate() + delta); return toKey(d); };
const dayOffsetStr = (a, b) => { const da = parseLocalDate(a), db = parseLocalDate(b); if (!da || !db) return 0; return Math.round((db - da) / 86400000); };

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

  // Limpieza única: borra filas vacías (sin nombre ni monto) que quedaron FUERA
  // del rango de fechas del viaje (basura de clics en "+ Tipo" con fechas viejas).
  const cleanedRef = useRef(false);
  useEffect(() => {
    if (cleanedRef.current || !loadedServices || !trip?.start_date || !trip?.end_date) return;
    const keys = new Set(buildDays(trip.start_date, trip.end_date).map(toKey));
    const junk = (servicesRef.current || []).filter((s) => !hasContent(s) && (!s.start_date || !keys.has(s.start_date)));
    cleanedRef.current = true;
    if (junk.length === 0) return;
    const ids = new Set(junk.map((j) => j.id));
    setServices((ss) => ss.filter((s) => !ids.has(s.id)));
    junk.forEach((j) => supabaseAPI.entities.TripService.delete(j.id).catch(() => {}));
  }, [loadedServices, trip]);

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
        trip_id: tripId, service_type: type, service_name: '', price: 0, commission: 0, start_date: dayKey,
        metadata: type === 'hotel' ? { check_in: dayKey } : {}, // el hotel entra ese día
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

  // ---- pestañas por tipo (editan un borrador; nada cambia hasta Guardar) ----
  const [mainTab, setMainTab] = useState('itinerario'); // 'itinerario' | tipo de servicio
  const [draft, setDraft] = useState([]);
  const [savingFolder, setSavingFolder] = useState(false);
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
  // Guarda varios campos de metadata a la vez (ej. check_out + nights + check_in)
  const onPanelSetMeta = (obj, persist) => {
    if (!panelId) return;
    setSvcLocal(panelId, (r) => ({ ...r, metadata: { ...r.metadata, ...obj } }));
    if (persist) {
      const r = servicesRef.current.find((x) => x.id === panelId);
      persistSvc(panelId, { metadata: { ...(r?.metadata || {}), ...obj } });
    }
  };

  // Aplica un patch de precio (price/commission base + payment_type/commission_auto
  // en metadata) de forma atómica. Lo usan el panel de detalle y la casilla.
  const setPricing = (id, patch) => {
    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
    const metaPatch = {
      ...(has('payment_type') ? { payment_type: patch.payment_type } : {}),
      ...(has('commission_auto') ? { commission_auto: patch.commission_auto } : {}),
    };
    setSvcLocal(id, (r) => ({
      ...r,
      ...(has('price') ? { price: patch.price } : {}),
      ...(has('commission') ? { commission: patch.commission } : {}),
      metadata: { ...r.metadata, ...metaPatch },
    }));
    const r = servicesRef.current.find((x) => x.id === id);
    persistSvc(id, {
      ...(has('price') ? { price: Number(patch.price) || 0 } : {}),
      ...(has('commission') ? { commission: Number(patch.commission) || 0 } : {}),
      metadata: { ...(r?.metadata || {}), ...metaPatch },
    });
  };

  // ---- pestañas por tipo: handlers que escriben SOLO en el borrador ----
  const seedDraft = () => servicesRef.current.map((s) => ({ ...s, metadata: { ...(s.metadata || {}) } }));
  const goType = (t) => { setDraft((d) => (d.length === 0 ? seedDraft() : d)); setMainTab(t); };
  const discardDraft = () => setDraft(seedDraft());
  const draftSet = (id, field, value, meta) =>
    setDraft((ds) => ds.map((r) => (r.id === id ? (meta ? { ...r, metadata: { ...r.metadata, [field]: value } } : { ...r, [field]: value }) : r)));
  const draftSetMeta = (id, obj) =>
    setDraft((ds) => ds.map((r) => (r.id === id ? { ...r, metadata: { ...r.metadata, ...obj } } : r)));
  const draftApplyPricing = (id, patch) => {
    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
    const metaPatch = {
      ...(has('payment_type') ? { payment_type: patch.payment_type } : {}),
      ...(has('commission_auto') ? { commission_auto: patch.commission_auto } : {}),
    };
    setDraft((ds) => ds.map((r) => (r.id === id ? {
      ...r,
      ...(has('price') ? { price: patch.price } : {}),
      ...(has('commission') ? { commission: patch.commission } : {}),
      metadata: { ...r.metadata, ...metaPatch },
    } : r)));
  };
  const draftToggleDelete = (id) => setDraft((ds) => ds.map((r) => (r.id === id ? { ...r, _del: !r._del } : r)));
  const editedFields = (d) => ({ service_name: d.service_name, price: Number(d.price) || 0, commission: Number(d.commission) || 0, metadata: d.metadata || {} });
  const isEdited = (d) => { const cur = servicesRef.current.find((s) => s.id === d.id); return cur && JSON.stringify(editedFields(cur)) !== JSON.stringify(editedFields(d)); };
  const saveFolder = async () => {
    setSavingFolder(true);
    try {
      const dels = draft.filter((d) => d._del);
      const delIds = new Set(dels.map((d) => d.id));
      const changed = draft.filter((d) => !d._del && isEdited(d));
      // Recién aquí se refleja en la tabla principal
      const merged = servicesRef.current
        .filter((s) => !delIds.has(s.id))
        .map((s) => { const d = draft.find((x) => x.id === s.id); return d ? { ...s, ...editedFields(d) } : s; });
      setServices(merged);
      for (const d of dels) await supabaseAPI.entities.TripService.delete(d.id).catch(() => {});
      for (const d of changed) await persistSvc(d.id, editedFields(d));
      setDraft(merged.map((s) => ({ ...s, metadata: { ...(s.metadata || {}) } })));
      const n = changed.length + dels.length;
      toast.success(n ? `Guardado (${n} cambio${n !== 1 ? 's' : ''})` : 'Sin cambios');
    } finally {
      setSavingFolder(false);
    }
  };
  const draftByType = useMemo(() => {
    const m = {};
    draft.filter(hasContent).forEach((s) => { (m[s.service_type] = m[s.service_type] || []).push(s); });
    Object.values(m).forEach((list) => list.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')));
    return m;
  }, [draft]);
  // Pestañas de tipo disponibles (solo tipos con servicios reales, no filas vacías)
  const typeTabs = useMemo(() => ALL_TYPES.filter((t) => services.some((s) => s.service_type === t && hasContent(s))), [services]);
  const typeCounts = useMemo(() => {
    const m = {}; services.filter(hasContent).forEach((s) => { m[s.service_type] = (m[s.service_type] || 0) + 1; }); return m;
  }, [services]);
  const draftDirty = useMemo(() => {
    if (draft.length === 0) return false;
    return draft.some((d) => d._del || (() => { const cur = services.find((s) => s.id === d.id); return cur && JSON.stringify(editedFields(cur)) !== JSON.stringify(editedFields(d)); })());
  }, [draft, services]);
  const dayKeySet = useMemo(() => new Set(days.map(toKey)), [days]);
  const activeTab = mainTab !== 'itinerario' && !typeTabs.includes(mainTab) ? 'itinerario' : mainTab;

  // Días que cubre cada hotel (para marcar sutilmente las noches en el itinerario)
  const hotelCont = useMemo(() => {
    const map = {};
    services.forEach((s) => {
      if (s.service_type !== 'hotel' || !s.start_date) return;
      let nights = parseInt(s.metadata?.nights, 10);
      if ((!nights || Number.isNaN(nights)) && s.metadata?.check_out) {
        const a = parseLocalDate(s.start_date), b = parseLocalDate(s.metadata.check_out);
        if (a && b) nights = Math.round((b - a) / 86400000);
      }
      if (!nights || nights <= 1) return;
      const name = s.service_name || s.metadata?.hotel_name || 'Hotel';
      for (let off = 1; off < nights; off++) map[shiftDateStr(s.start_date, off)] = name;
    });
    return map;
  }, [services]);

  // Vuelos que llegan en un día distinto al de salida (cruce de husos horarios):
  // se marca "Llega …" en la columna de Vuelos del día de llegada.
  const flightArrivals = useMemo(() => {
    const map = {};
    services.forEach((s) => {
      if (s.service_type !== 'vuelo' || !s.start_date) return;
      const arr = s.metadata?.arrival_date;
      if (!arr || arr <= s.start_date) return;
      const name = s.service_name || s.metadata?.airline || 'Vuelo';
      (map[arr] = map[arr] || []).push({ name, time: s.metadata?.arrival_time || '' });
    });
    return map;
  }, [services]);

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
        {activeTab === 'itinerario' && (
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
        )}
      </div>

      {/* Pestañas: Itinerario (tabla) + una por cada tipo con servicios */}
      <div className="max-w-[1400px] mx-auto w-full px-5 pt-3">
        <div className="flex items-end gap-1 border-b border-stone-200 overflow-x-auto">
          <button onClick={() => setMainTab('itinerario')}
            className={`px-3.5 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'itinerario' ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
            Itinerario
          </button>
          {typeTabs.map((t) => {
            const on = activeTab === t;
            return (
              <button key={t} onClick={() => goType(t)}
                className={`px-3.5 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${on ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
                {TYPE_LABEL[t]}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}>{typeCounts[t]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1">
        {activeTab === 'itinerario' && (
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
                          const cont = t === 'hotel' ? hotelCont[key] : null;
                          const arrivals = t === 'vuelo' ? (flightArrivals[key] || []) : [];
                          return (
                            <td key={t} className="px-1.5 py-1.5">
                              <Droppable droppableId={`${key}|${t}`} isDropDisabled={!!draggingType && draggingType !== t}>
                                {(prov, snap) => (
                                  <div ref={prov.innerRef} {...prov.droppableProps}
                                    className={`space-y-1 rounded-lg transition-colors ${snap.isDraggingOver ? 'ring-2 ring-emerald-300 bg-emerald-50/50' : cont ? 'bg-emerald-50/40' : ''}`}>
                                    {arrivals.map((a, ai) => (
                                      <div key={`arr-${ai}`} title={`Llega ${a.name}${a.time ? ' · ' + a.time : ''}`}
                                        className="text-[10px] text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5 flex items-center gap-1 truncate">
                                        <PlaneLanding className="w-2.5 h-2.5 flex-shrink-0" /> Llega {a.name}{a.time ? ` · ${a.time}` : ''}
                                      </div>
                                    ))}
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
                                            {s.service_type === 'vuelo' && (s.metadata?.departure_time || s.metadata?.arrival_time) && (
                                              <div className="text-[10px] text-stone-400 px-1 flex items-center gap-1 tabular-nums whitespace-nowrap" title="Salida → Llegada">
                                                <Plane className="w-2.5 h-2.5 flex-shrink-0" /> {s.metadata?.departure_time || '—'} → {s.metadata?.arrival_time || '—'}
                                                {s.metadata?.arrival_date && dayOffsetStr(s.start_date, s.metadata.arrival_date) > 0 && (
                                                  <span className="text-amber-600 font-semibold">+{dayOffsetStr(s.start_date, s.metadata.arrival_date)}</span>
                                                )}
                                              </div>
                                            )}
                                            <input type="number" step="0.01" min="0" placeholder="$0" className={cellPrice} value={s.price ?? 0}
                                              title={pricingView(s).pt === 'neto' ? 'Total final (neto + comisión)' : 'Total (bruto)'}
                                              onChange={(e) => setSvcLocal(s.id, (r) => ({ ...r, price: e.target.value }))} onBlur={() => setPricing(s.id, applyTotal(s, s.price))} />
                                            {(() => {
                                              const pv = pricingView(s);
                                              return (
                                                <div className="flex items-center justify-between gap-1 px-1">
                                                  <button type="button" title="Cambiar bruto/neto"
                                                    onClick={() => setPricing(s.id, applyType(s, pv.pt === 'neto' ? 'bruto' : 'neto'))}
                                                    className="flex items-center gap-1 text-[9px] font-medium text-stone-400 hover:text-stone-600">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${pv.pt === 'neto' ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                                                    {pv.pt === 'neto' ? 'Neto' : 'Bruto'}
                                                  </button>
                                                  {pv.commission > 0 && <span className="text-[9px] text-stone-300 tabular-nums truncate" title="Comisión">{money(pv.commission)}</span>}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {prov.placeholder}
                                    {cont && cell.length === 0 && (
                                      <div className="text-[10px] text-emerald-600/80 px-1 flex items-center gap-1 truncate" title={`Continúa en ${cont}`}>
                                        <span className="opacity-50">▸</span> {cont}
                                      </div>
                                    )}
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
        )}

        {activeTab !== 'itinerario' && (
        <div className="max-w-[1400px] mx-auto px-5 py-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-stone-800">{TYPE_LABEL[activeTab]}</h2>
              <p className="text-xs text-stone-400">{(draftByType[activeTab] || []).length} servicio{(draftByType[activeTab] || []).length !== 1 ? 's' : ''} en la cotización</p>
            </div>
            <div className="flex items-center gap-2">
              {draftDirty && <span className="text-xs text-amber-600 font-medium hidden sm:inline">Cambios sin guardar</span>}
              <Button variant="outline" onClick={discardDraft} disabled={savingFolder || !draftDirty} className="rounded-xl">Descartar</Button>
              <Button onClick={saveFolder} disabled={savingFolder} className="rounded-xl text-white" style={{ backgroundColor: GREEN }}>
                {savingFolder ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />} Guardar
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {(draftByType[activeTab] || []).map((s) => {
              const outRange = !s.start_date || !dayKeySet.has(s.start_date);
              if (s._del) {
                return (
                  <div key={s.id} className="bg-stone-50 rounded-2xl border border-dashed border-stone-200 px-5 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-stone-400 line-through truncate">{s.service_name || TYPE_LABEL[s.service_type]}{s.start_date ? ` · ${formatDate(parseLocalDate(s.start_date), 'd MMM', { locale: es })}` : ''}</span>
                    <button onClick={() => draftToggleDelete(s.id)} className="text-xs font-semibold text-stone-500 hover:text-stone-700 flex-shrink-0">Deshacer</button>
                  </div>
                );
              }
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="flex items-center gap-1.5 mb-4 text-xs">
                    <span className="font-bold text-emerald-700 uppercase tracking-wide">{TYPE_LABEL[s.service_type]}</span>
                    {s.start_date && <span className="text-stone-400">· {formatDate(parseLocalDate(s.start_date), 'EEE d MMM', { locale: es })}</span>}
                    {dayInfo[s.start_date]?.city && <span className="text-stone-400 truncate">· {dayInfo[s.start_date].city}</span>}
                    {outRange && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">fuera del itinerario</span>}
                    <span className="flex-1" />
                    <button onClick={() => draftToggleDelete(s.id)} title="Eliminar servicio" className="p-1 rounded text-stone-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <ServiceEditor grid service={s}
                    onSet={(f, v, m) => draftSet(s.id, f, v, m)}
                    onSetMeta={(obj) => draftSetMeta(s.id, obj)}
                    onApplyPricing={(patch) => draftApplyPricing(s.id, patch)} />
                </div>
              );
            })}
            {(draftByType[activeTab] || []).length === 0 && (
              <p className="text-center text-stone-400 text-sm py-10">Sin servicios de este tipo.</p>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-4">Los cambios aquí <strong>no tocan la tabla</strong> hasta que presiones <strong>Guardar</strong>.</p>
        </div>
        )}
      </main>

      <ServiceDetailPanel
        service={panelService}
        onSet={onPanelSet}
        onSetMeta={onPanelSetMeta}
        onApplyPricing={(patch) => { if (panelId) setPricing(panelId, patch); }}
        onDelete={() => { if (panelId) { deleteService(panelId); setPanelId(null); } }}
        onClose={() => setPanelId(null)}
      />
    </div>
  );
}
