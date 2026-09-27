import { useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { daysBetween, dateForIndex } from '@/lib/quoteEngine';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Paso 1: esqueleto del editor — barra superior + días. La captura de servicios,
// tarjetas, totales, faltantes y acciones llegan en los pasos siguientes.
export default function QuoteEditor() {
  const quoteId = new URLSearchParams(window.location.search).get('id');
  const queryClient = useQueryClient();

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => supabaseAPI.entities.Quote.filter({ id: quoteId }).then(r => r[0]),
    enabled: !!quoteId,
  });
  const { data: rawDays = [] } = useQuery({
    queryKey: ['quoteDays', quoteId],
    queryFn: () => supabaseAPI.entities.QuoteDay.filter({ quote_id: quoteId }),
    enabled: !!quoteId,
  });
  const days = useMemo(() => [...rawDays].sort((a, b) => a.day_index - b.day_index), [rawDays]);

  const updateQuote = useMutation({
    mutationFn: (data) => supabaseAPI.entities.Quote.update(quoteId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote', quoteId] }),
    onError: () => toast.error('No se pudo guardar'),
  });
  const updateDay = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.QuoteDay.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quoteDays', quoteId] }),
    onError: () => toast.error('No se pudo guardar el día'),
  });

  // Al cambiar fechas: agregar/quitar días al final (los vacíos) y re-fechar todos.
  const syncDaysToDates = async (start, end) => {
    const n = daysBetween(start, end);
    const sorted = [...rawDays].sort((a, b) => a.day_index - b.day_index);
    // re-fechar
    await Promise.all(sorted.map((d, i) => {
      const date = dateForIndex(start, i);
      return d.date === date ? null : supabaseAPI.entities.QuoteDay.update(d.id, { date });
    }));
    if (n > sorted.length) {
      const extra = Array.from({ length: n - sorted.length }, (_, k) => ({
        quote_id: quoteId, day_index: sorted.length + k, date: dateForIndex(start, sorted.length + k),
        city: sorted.length ? sorted[sorted.length - 1].city : '', is_free: false,
      }));
      await supabaseAPI.entities.QuoteDay.bulkCreate(extra);
    } else if (n < sorted.length) {
      const toRemove = sorted.slice(n);
      await Promise.all(toRemove.map(d => supabaseAPI.entities.QuoteDay.delete(d.id)));
    }
    queryClient.invalidateQueries({ queryKey: ['quoteDays', quoteId] });
  };

  const onQuoteField = (field, value) => {
    const patch = { [field]: value };
    updateQuote.mutate(patch, {
      onSuccess: () => {
        if (field === 'start_date' || field === 'end_date') {
          const start = field === 'start_date' ? value : quote.start_date;
          const end = field === 'end_date' ? value : quote.end_date;
          if (start && end && end >= start) syncDaysToDates(start, end);
        }
      },
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} /></div>;
  }
  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500">Cotización no encontrada.</p>
        <Link to={createPageUrl('Quotes')} className="text-sm" style={{ color: '#2E442A' }}>Volver a Cotizaciones</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Barra superior */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-3 flex flex-wrap items-end gap-4">
        <Link to={createPageUrl('Quotes')} className="text-stone-400 hover:text-stone-700 pb-1"><ArrowLeft className="w-5 h-5" /></Link>
        <Field label="Viaje" wide>
          <Input defaultValue={quote.trip_name || ''} onBlur={(e) => onQuoteField('trip_name', e.target.value)} className="font-medium" />
        </Field>
        <Field label="Salida">
          <Input type="date" defaultValue={quote.start_date || ''} onChange={(e) => onQuoteField('start_date', e.target.value)} />
        </Field>
        <Field label="Regreso">
          <Input type="date" defaultValue={quote.end_date || ''} onChange={(e) => onQuoteField('end_date', e.target.value)} />
        </Field>
        <Field label="Pax" narrow>
          <Input type="number" min={1} defaultValue={quote.pax || 1} onBlur={(e) => onQuoteField('pax', Number(e.target.value) || 1)} />
        </Field>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#2E442A', fontFamily: 'Playfair Display, serif' }}>{quote.trip_name || 'Cotización'}</h1>
        <p className="text-sm text-stone-500 mb-6">
          versión {quote.version} · {days.length} días · {Math.max(0, days.length - 1)} noches
        </p>

        <div className="space-y-3">
          {days.map((d) => (
            <div key={d.id} className={`bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex items-center gap-4 ${d.is_free ? 'opacity-70' : ''}`}>
              <div className="text-center w-14 flex-shrink-0">
                <div className="text-2xl font-bold" style={{ color: '#C9A84C', fontFamily: 'Playfair Display, serif' }}>{String(d.day_index + 1).padStart(2, '0')}</div>
                <div className="text-[10px] text-stone-400">{d.date ? formatDate(d.date, 'EEE d MMM', { locale: es }) : ''}</div>
              </div>
              <div className="flex-1 min-w-0">
                <Input defaultValue={d.city || ''} placeholder="Ciudad"
                  onBlur={(e) => updateDay.mutate({ id: d.id, data: { city: e.target.value } })} className="font-medium" />
              </div>
              <button onClick={() => updateDay.mutate({ id: d.id, data: { is_free: !d.is_free } })}
                className={`text-xs px-2 py-1 rounded-lg border flex-shrink-0 ${d.is_free ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-stone-400 border-stone-200'}`}>
                {d.is_free ? 'Día libre' : 'Marcar libre'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-stone-400 mt-6 text-center">
          La captura de servicios, totales y faltantes llega en el siguiente paso.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, wide, narrow }) {
  return (
    <div className={`flex flex-col ${wide ? 'flex-1 min-w-[160px]' : narrow ? 'w-20' : 'w-40'}`}>
      <label className="text-[11px] text-stone-400 mb-0.5">{label}</label>
      {children}
    </div>
  );
}
