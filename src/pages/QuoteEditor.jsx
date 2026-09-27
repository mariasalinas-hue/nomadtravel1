import { useState, useEffect, useRef, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { DragDropContext } from '@hello-pangea/dnd';
import { ArrowLeft, Loader2, Plus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  rulesFor, totals, missing, hotelCover, grossFromNet, commissionOf,
  daysBetween, dateForIndex,
} from '@/lib/quoteEngine';
import DayBlock from '@/components/quoteday/DayBlock';
import QuoteSidebar from '@/components/quoteday/QuoteSidebar';

const SVC_COLS = ['type', 'name', 'description', 'supplier', 'price_mode', 'net', 'gross', 'commission', 'nights', 'rooms', 'breakfast', 'sort_order', 'quote_day_id'];
const pickSvc = (s) => Object.fromEntries(SVC_COLS.map(k => [k, s[k] ?? null]));

export default function QuoteEditor() {
  const quoteId = new URLSearchParams(window.location.search).get('id');

  const { data: quote, isLoading, refetch: refetchQuote } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => supabaseAPI.entities.Quote.filter({ id: quoteId }).then(r => r[0]),
    enabled: !!quoteId,
    refetchOnWindowFocus: false,
  });
  const { data: rawDays } = useQuery({
    queryKey: ['quoteDays', quoteId],
    queryFn: () => supabaseAPI.entities.QuoteDay.filter({ quote_id: quoteId }),
    enabled: !!quoteId, refetchOnWindowFocus: false,
  });
  const { data: rawServices } = useQuery({
    queryKey: ['quoteServices', quoteId],
    queryFn: async () => {
      const dayRows = await supabaseAPI.entities.QuoteDay.filter({ quote_id: quoteId });
      const ids = dayRows.map(d => d.id);
      if (!ids.length) return [];
      const all = await supabaseAPI.entities.QuoteService.list();
      return all.filter(s => ids.includes(s.quote_day_id));
    },
    enabled: !!quoteId, refetchOnWindowFocus: false,
  });

  const [days, setDays] = useState(null);
  const daysRef = useRef([]);
  useEffect(() => { daysRef.current = days || []; }, [days]);
  const loadedRef = useRef(false);

  // Ensamblar una vez: días ordenados con sus servicios.
  useEffect(() => {
    if (loadedRef.current || !rawDays || !rawServices) return;
    const assembled = [...rawDays].sort((a, b) => a.day_index - b.day_index).map(d => ({
      ...d,
      services: rawServices.filter(s => s.quote_day_id === d.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));
    setDays(assembled);
    loadedRef.current = true;
  }, [rawDays, rawServices]);

  const rules = useMemo(() => rulesFor(quote), [quote]);
  const pax = quote?.pax || 1;

  // Indicador de guardado.
  const [pending, setPending] = useState(0);
  const track = (p) => { setPending(n => n + 1); return Promise.resolve(p).catch(() => toast.error('No se pudo guardar')).finally(() => setPending(n => Math.max(0, n - 1))); };
  const persistService = (id, s) => track(supabaseAPI.entities.QuoteService.update(id, pickSvc(s)));
  const persistDay = (id, patch) => track(supabaseAPI.entities.QuoteDay.update(id, patch));
  const persistQuote = (patch) => track(supabaseAPI.entities.Quote.update(quoteId, patch)).then(() => refetchQuote());

  // ---- servicios ----
  const updateService = (serviceId, patch) => {
    let saved = null;
    const next = daysRef.current.map(d => ({
      ...d,
      services: d.services.map(s => {
        if (s.id !== serviceId) return s;
        const n = { ...s, ...patch };
        if (n.price_mode === 'net' && !('gross' in patch) && (('net' in patch) || ('price_mode' in patch) || ('nights' in patch))) {
          n.gross = Math.round(grossFromNet(n, rules, pax));
        }
        n.commission = commissionOf(n);
        saved = n;
        return n;
      }),
    }));
    setDays(next);
    if (saved) persistService(serviceId, saved);
  };

  const addService = async (dayId, type) => {
    const day = daysRef.current.find(d => d.id === dayId);
    const sort_order = day?.services?.length ? Math.max(...day.services.map(s => s.sort_order || 0)) + 1 : 0;
    const base = { quote_day_id: dayId, type, name: '', description: '', supplier: '', price_mode: 'gross', net: null, gross: null, commission: 0, sort_order };
    if (type === 'hotel') { base.nights = 1; base.rooms = Math.ceil(pax / 2); base.breakfast = false; }
    const created = await track(supabaseAPI.entities.QuoteService.create(base));
    if (created) setDays(prev => prev.map(d => d.id === dayId ? { ...d, services: [...d.services, created] } : d));
  };

  const deleteService = (serviceId) => {
    setDays(prev => prev.map(d => ({ ...d, services: d.services.filter(s => s.id !== serviceId) })));
    track(supabaseAPI.entities.QuoteService.delete(serviceId));
  };

  const duplicateService = async (serviceId) => {
    const day = daysRef.current.find(d => d.services.some(s => s.id === serviceId));
    const s = day.services.find(x => x.id === serviceId);
    const { id: _omit, ...rest } = s;
    const created = await track(supabaseAPI.entities.QuoteService.create({ ...pickSvc(rest), sort_order: (s.sort_order || 0) + 1 }));
    if (created) setDays(prev => prev.map(d => d.id === day.id ? { ...d, services: [...d.services, created] } : d));
  };

  // ---- días ----
  const persistDayOrder = (arr) => arr.forEach((d, i) => { if (d.day_index !== i) persistDay(d.id, { day_index: i }); });

  const setCity = (dayId, city) => { setDays(prev => prev.map(d => d.id === dayId ? { ...d, city } : d)); persistDay(dayId, { city }); };
  const toggleFree = (dayId) => setDays(prev => prev.map(d => { if (d.id !== dayId) return d; persistDay(dayId, { is_free: !d.is_free }); return { ...d, is_free: !d.is_free }; }));

  const moveDay = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= daysRef.current.length) return;
    const arr = [...daysRef.current];
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const reindexed = arr.map((d, i) => ({ ...d, day_index: i, date: dateForIndex(quote.start_date, i) }));
    setDays(reindexed);
    reindexed.forEach((d, i) => persistDay(d.id, { day_index: i, date: d.date }));
  };

  const duplicateDay = async (index) => {
    const src = daysRef.current[index];
    const newDay = await track(supabaseAPI.entities.QuoteDay.create({ quote_id: quoteId, day_index: index + 1, date: src.date, city: src.city, is_free: src.is_free }));
    if (!newDay) return;
    const copies = [];
    for (const s of src.services) {
      const { id: _omit, ...rest } = s;
      const c = await track(supabaseAPI.entities.QuoteService.create({ ...pickSvc(rest), quote_day_id: newDay.id }));
      if (c) copies.push(c);
    }
    const arr = [...daysRef.current];
    arr.splice(index + 1, 0, { ...newDay, services: copies });
    const reindexed = arr.map((d, i) => ({ ...d, day_index: i, date: dateForIndex(quote.start_date, i) }));
    setDays(reindexed);
    persistDayOrder(reindexed);
    persistQuote({ end_date: dateForIndex(quote.start_date, reindexed.length - 1) });
  };

  const deleteDay = (index) => {
    const d = daysRef.current[index];
    if (daysRef.current.length <= 1) return;
    if (d.services.length && !window.confirm('Este día tiene servicios. ¿Eliminarlo?')) return;
    d.services.forEach(s => track(supabaseAPI.entities.QuoteService.delete(s.id)));
    track(supabaseAPI.entities.QuoteDay.delete(d.id));
    const arr = daysRef.current.filter((_, i) => i !== index).map((x, i) => ({ ...x, day_index: i, date: dateForIndex(quote.start_date, i) }));
    setDays(arr);
    arr.forEach((x, i) => persistDay(x.id, { day_index: i, date: x.date }));
    persistQuote({ end_date: dateForIndex(quote.start_date, Math.max(0, arr.length - 1)) });
  };

  const addDayAtEnd = async () => {
    const i = daysRef.current.length;
    const newDay = await track(supabaseAPI.entities.QuoteDay.create({
      quote_id: quoteId, day_index: i, date: dateForIndex(quote.start_date, i),
      city: daysRef.current[i - 1]?.city || '', is_free: false,
    }));
    if (!newDay) return;
    setDays(prev => [...prev, { ...newDay, services: [] }]);
    persistQuote({ end_date: dateForIndex(quote.start_date, i) });
  };

  // ---- barra superior ----
  const onTripField = (field, value) => {
    persistQuote({ [field]: value });
    if (field === 'pax') {
      const p = Number(value) || 1;
      setDays(prev => prev.map(d => ({ ...d, services: d.services.map(s => {
        if (s.price_mode !== 'net' || s.net == null) return s;
        const n = { ...s, gross: Math.round(grossFromNet(s, rules, p)) };
        n.commission = commissionOf(n);
        persistService(s.id, n);
        return n;
      }) })));
    }
    if (field === 'start_date' || field === 'end_date') {
      const start = field === 'start_date' ? value : quote.start_date;
      const end = field === 'end_date' ? value : quote.end_date;
      if (start && end && end >= start) syncDaysToDates(start, end);
    }
  };

  const syncDaysToDates = async (start, end) => {
    const n = daysBetween(start, end);
    let arr = [...daysRef.current];
    // re-fechar
    arr = arr.map((d, i) => ({ ...d, date: dateForIndex(start, i) }));
    arr.forEach((d) => persistDay(d.id, { date: d.date }));
    if (n > arr.length) {
      for (let k = arr.length; k < n; k++) {
        const nd = await track(supabaseAPI.entities.QuoteDay.create({ quote_id: quoteId, day_index: k, date: dateForIndex(start, k), city: arr[arr.length - 1]?.city || '', is_free: false }));
        if (nd) arr.push({ ...nd, services: [] });
      }
    } else if (n < arr.length) {
      // quitar solo los del final que estén vacíos
      while (arr.length > n && !arr[arr.length - 1].services.length) {
        const rem = arr.pop();
        track(supabaseAPI.entities.QuoteDay.delete(rem.id));
      }
    }
    setDays([...arr]);
  };

  // ---- drag & drop ----
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const cur = daysRef.current;
    const srcDay = cur.find(d => d.id === source.droppableId);
    const moving = srcDay.services[source.index];
    const srcServices = [...srcDay.services]; srcServices.splice(source.index, 1);
    const sameDay = source.droppableId === destination.droppableId;
    const dstBase = sameDay ? srcServices : [...cur.find(d => d.id === destination.droppableId).services];
    dstBase.splice(destination.index, 0, { ...moving, quote_day_id: destination.droppableId });
    const next = cur.map(d => {
      if (d.id === source.droppableId && sameDay) return { ...d, services: dstBase };
      if (d.id === source.droppableId) return { ...d, services: srcServices };
      if (d.id === destination.droppableId) return { ...d, services: dstBase };
      return d;
    });
    setDays(next);
    const affected = new Set([source.droppableId, destination.droppableId]);
    next.forEach(d => { if (affected.has(d.id)) d.services.forEach((s, i) => persistService(s.id, { ...s, sort_order: i, quote_day_id: d.id })); });
  };

  const cover = useMemo(() => (days ? hotelCover(days) : {}), [days]);
  const t = useMemo(() => (days ? totals(days) : { byType: {}, sum: 0, commission: 0 }), [days]);
  const miss = useMemo(() => (days ? missing(days) : []), [days]);
  const goToDay = (i) => document.getElementById(`qd-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  if (isLoading || days === null) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} /></div>;
  }
  if (!quote) {
    return <div className="text-center py-16"><p className="text-stone-500">Cotización no encontrada.</p><Link to={createPageUrl('Quotes')} className="text-sm" style={{ color: '#2E442A' }}>Volver</Link></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Barra superior */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-5 py-3 flex flex-wrap items-end gap-4">
        <Link to={createPageUrl('Quotes')} className="text-stone-400 hover:text-stone-700 pb-1"><ArrowLeft className="w-5 h-5" /></Link>
        <TopField label="Viaje" className="flex-1 min-w-[160px]">
          <Input defaultValue={quote.trip_name || ''} onBlur={(e) => onTripField('trip_name', e.target.value)} className="font-medium" />
        </TopField>
        <TopField label="Salida" className="w-40">
          <Input type="date" defaultValue={quote.start_date || ''} onChange={(e) => onTripField('start_date', e.target.value)} />
        </TopField>
        <TopField label="Regreso" className="w-40">
          <Input type="date" defaultValue={quote.end_date || ''} onChange={(e) => onTripField('end_date', e.target.value)} />
        </TopField>
        <TopField label="Pax" className="w-20">
          <Input type="number" min={1} defaultValue={quote.pax || 1} onBlur={(e) => onTripField('pax', Number(e.target.value) || 1)} />
        </TopField>
        <span className="text-xs text-stone-400 pb-1.5 flex items-center gap-1 ml-auto">
          {pending > 0 ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</> : <><Check className="w-3 h-3 text-emerald-500" /> Guardado</>}
        </span>
      </div>

      <div className="max-w-[1180px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Días */}
        <div className="px-5 py-6 min-w-0">
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#2E442A', fontFamily: 'Playfair Display, serif' }}>{quote.trip_name || 'Cotización'}</h1>
          <p className="text-sm text-stone-500 mb-6">versión {quote.version} · {days.length} días · {Math.max(0, days.length - 1)} noches</p>

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="space-y-1">
              {days.map((d, i) => (
                <div key={d.id} id={`qd-${i}`} className="py-3 border-t border-stone-200 first:border-t-0">
                  <DayBlock
                    day={d} index={i} isLast={i === days.length - 1} pax={pax} rules={rules} cover={cover[i]}
                    onCityChange={(v) => setCity(d.id, v)}
                    onToggleFree={() => toggleFree(d.id)}
                    onMoveDay={(dir) => moveDay(i, dir)}
                    onDuplicateDay={() => duplicateDay(i)}
                    onDeleteDay={() => deleteDay(i)}
                    onAddService={(type) => addService(d.id, type)}
                    updateService={updateService}
                    deleteService={deleteService}
                    duplicateService={duplicateService}
                  />
                </div>
              ))}
            </div>
          </DragDropContext>

          <div className="mt-6 pt-4 border-t border-stone-200">
            <Button variant="outline" onClick={addDayAtEnd} className="rounded-xl text-stone-500">
              <Plus className="w-4 h-4 mr-1.5" /> Agregar un día al final
            </Button>
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="lg:sticky lg:top-[57px] lg:self-start lg:h-[calc(100vh-57px)] lg:overflow-auto border-l border-stone-200 bg-white px-5 py-6">
          <QuoteSidebar totals={t} pax={pax} missing={miss} onGoToDay={goToDay} />
        </aside>
      </div>
    </div>
  );
}

function TopField({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-[11px] text-stone-400 mb-0.5">{label}</label>
      {children}
    </div>
  );
}
