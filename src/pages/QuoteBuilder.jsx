import { useState, useEffect, useRef } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Eye, CheckCircle2, Copy, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GREEN = '#2E442A';

const STAGE_LABELS = {
  nuevo: 'Nuevo', cotizando: 'Cotizando', propuesta_enviada: 'Propuesta enviada',
  aceptado: 'Aceptado', vendido: 'Vendido', perdido: 'Perdido',
};

// Tipos alineados con los que Corsario ya sabe mostrar (para que al Vender se
// vean bien). "Renta de auto" y "Seguro" entran como "Otro" por ahora.
const SERVICE_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'vuelo', label: 'Vuelo' },
  { value: 'tour', label: 'Tour' },
  { value: 'traslado', label: 'Transfer' },
  { value: 'tren', label: 'Tren' },
  { value: 'crucero', label: 'Crucero' },
  { value: 'dmc', label: 'DMC' },
  { value: 'otro', label: 'Otro' },
];

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

// Aplana metadata para edición y garantiza que metadata sea objeto
const flatten = (s) => ({ ...s, metadata: s.metadata || {}, price: s.price ?? s.total_price ?? 0 });

export default function QuoteBuilder() {
  const tripId = new URLSearchParams(window.location.search).get('trip_id');
  const { user } = useUser();

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['quote-trip', tripId],
    queryFn: () => supabaseAPI.entities.Trip.filter({ id: tripId }).then((r) => r[0]),
    enabled: !!tripId,
  });

  const { data: loadedServices, isLoading: svcLoading, isError: svcError } = useQuery({
    queryKey: ['quote-services', tripId],
    queryFn: async () => {
      const raw = await supabaseAPI.entities.TripService.filter({ trip_id: tripId });
      return raw.map(flatten);
    },
    enabled: !!tripId,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Estado local editable (no re-consultamos en cada tecla para no perder foco)
  const [rows, setRows] = useState([]);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { if (loadedServices) setRows(loadedServices); }, [loadedServices]);

  const setLocal = (id, updater) => setRows((rs) => rs.map((r) => (r.id === id ? updater(r) : r)));

  const persist = (id, patch) =>
    supabaseAPI.entities.TripService.update(id, patch).catch(() => toast.error('No se pudo guardar el cambio'));

  const saveField = (id, field) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (!r) return;
    let val = r[field];
    if (field === 'price' || field === 'commission') val = parseFloat(val) || 0;
    persist(id, { [field]: val });
  };
  const saveMeta = (id) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (r) persist(id, { metadata: r.metadata || {} });
  };

  const addRow = async () => {
    try {
      const created = await supabaseAPI.entities.TripService.create({
        trip_id: tripId,
        service_type: 'hotel',
        service_name: '',
        price: 0,
        commission: 0,
        metadata: {},
        ...(user?.primaryEmailAddress?.emailAddress ? { created_by: user.primaryEmailAddress.emailAddress } : {}),
      });
      setRows((rs) => [...rs, flatten(created)]);
    } catch {
      toast.error('No se pudo agregar (¿ya corriste la migración del Cotizador?)');
    }
  };

  const duplicateRow = async (row) => {
    try {
      const created = await supabaseAPI.entities.TripService.create({
        trip_id: tripId,
        service_type: row.service_type,
        service_name: row.service_name,
        price: parseFloat(row.price) || 0,
        commission: parseFloat(row.commission) || 0,
        start_date: row.start_date || null,
        metadata: { ...(row.metadata || {}) },
        ...(user?.primaryEmailAddress?.emailAddress ? { created_by: user.primaryEmailAddress.emailAddress } : {}),
      });
      setRows((rs) => {
        const i = rs.findIndex((r) => r.id === row.id);
        const next = [...rs];
        next.splice(i + 1, 0, flatten(created));
        return next;
      });
    } catch {
      toast.error('No se pudo duplicar');
    }
  };

  const deleteRow = async (id) => {
    const prev = rowsRef.current;
    setRows((rs) => rs.filter((r) => r.id !== id));
    try {
      await supabaseAPI.entities.TripService.delete(id);
    } catch {
      toast.error('No se pudo eliminar');
      setRows(prev);
    }
  };

  const total = rows.reduce((a, r) => a + (parseFloat(r.price) || 0), 0);

  if (!tripId) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Falta el parámetro trip_id.</div>;
  }
  if (tripLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }
  if (!trip) {
    return <div className="min-h-screen flex items-center justify-center text-stone-500">Cotización no encontrada.</div>;
  }

  const dates = [
    trip.start_date && formatDate(trip.start_date, 'd MMM', { locale: es }),
    trip.end_date && formatDate(trip.end_date, 'd MMM yyyy', { locale: es }),
  ].filter(Boolean).join(' – ');

  const cell = 'px-2 py-1.5 border-b border-stone-100 align-middle';
  const inputCls = 'w-full bg-transparent text-sm text-stone-800 outline-none rounded px-1.5 py-1 focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-300';

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200">
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
            <p className="text-xs text-stone-400 truncate">
              {trip.client_name}{trip.destination ? ` · ${trip.destination}` : ''}{dates ? ` · ${dates}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={addRow}>
              <Plus className="w-4 h-4 mr-1.5" /> Agregar servicio
            </Button>
            <Button variant="outline" className="rounded-xl" disabled title="En el siguiente paso">
              <Eye className="w-4 h-4 mr-1.5" /> Preview cliente
            </Button>
            <Button className="rounded-xl text-white" style={{ backgroundColor: GREEN }} disabled title="En el siguiente paso">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Vender viaje
            </Button>
          </div>
        </div>
      </header>

      {/* Spreadsheet */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-5 py-6">
          {svcError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No se pudieron cargar los servicios. Si es la primera vez, falta correr la <strong>migración del Cotizador</strong> en Supabase (agrega la columna <code>trip_id</code>).
            </div>
          )}

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    <th className="w-8 px-2 py-2.5"></th>
                    <th className="w-10 px-2 py-2.5 text-left">#</th>
                    <th className="w-32 px-2 py-2.5 text-left">Fecha</th>
                    <th className="w-48 px-2 py-2.5 text-left">De / A</th>
                    <th className="px-2 py-2.5 text-left">Actividad</th>
                    <th className="w-32 px-2 py-2.5 text-left">Tipo</th>
                    <th className="w-32 px-2 py-2.5 text-right">Precio</th>
                    <th className="w-16 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className="group hover:bg-stone-50/60">
                      <td className={`${cell} text-stone-300`}><GripVertical className="w-4 h-4" /></td>
                      <td className={`${cell} text-stone-400 text-sm tabular-nums`}>{i + 1}</td>
                      <td className={cell}>
                        <input
                          type="date"
                          className={inputCls}
                          value={row.start_date || ''}
                          onChange={(e) => { setLocal(row.id, (r) => ({ ...r, start_date: e.target.value })); }}
                          onBlur={() => saveField(row.id, 'start_date')}
                        />
                      </td>
                      <td className={cell}>
                        <input
                          className={inputCls}
                          placeholder="MTY → Tokyo"
                          value={row.metadata?.route || ''}
                          onChange={(e) => setLocal(row.id, (r) => ({ ...r, metadata: { ...r.metadata, route: e.target.value } }))}
                          onBlur={() => saveMeta(row.id)}
                        />
                      </td>
                      <td className={cell}>
                        <input
                          className={inputCls}
                          placeholder="Descripción del servicio…"
                          value={row.service_name || ''}
                          onChange={(e) => setLocal(row.id, (r) => ({ ...r, service_name: e.target.value }))}
                          onBlur={() => saveField(row.id, 'service_name')}
                        />
                      </td>
                      <td className={cell}>
                        <select
                          className={`${inputCls} cursor-pointer`}
                          value={row.service_type || 'otro'}
                          onChange={(e) => { setLocal(row.id, (r) => ({ ...r, service_type: e.target.value })); persist(row.id, { service_type: e.target.value }); }}
                        >
                          {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td className={`${cell} text-right`}>
                        <input
                          type="number" step="0.01" min="0"
                          className={`${inputCls} text-right tabular-nums`}
                          value={row.price ?? 0}
                          onChange={(e) => setLocal(row.id, (r) => ({ ...r, price: e.target.value }))}
                          onBlur={() => saveField(row.id, 'price')}
                        />
                      </td>
                      <td className={`${cell} text-right whitespace-nowrap`}>
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => duplicateRow(row)} title="Duplicar" className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteRow(row.id)} title="Eliminar" className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && !svcLoading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">
                        Aún no hay servicios. Dale <strong>“Agregar servicio”</strong> para empezar a armar el viaje.
                      </td>
                    </tr>
                  )}
                  {svcLoading && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-300" /></td></tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-50 font-semibold text-stone-700">
                      <td colSpan={6} className="px-3 py-2.5 text-right text-sm">Total del viaje</td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums">{money(total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Agregar fila al final */}
            <button
              onClick={addRow}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-50 border-t border-stone-100 transition-colors"
            >
              <Plus className="w-4 h-4" /> Agregar servicio
            </button>
          </div>

          <p className="text-xs text-stone-400 mt-3">
            Se guarda automáticamente. En el siguiente paso: panel de detalle por servicio, precios por tipo (noches × habitaciones…), agrupar por ciudad, preview del cliente y el botón Vender.
          </p>
        </div>
      </main>
    </div>
  );
}
