import { useQuery } from '@tanstack/react-query';
import { supabaseAPI } from '@/api/supabaseClient';
import { resolveOptions, totals, money } from '@/lib/quoteEngine';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Calendar, Users, Trash2, Loader2 } from 'lucide-react';

const STATUS = {
  draft: { label: 'Borrador', cls: 'bg-stone-100 text-stone-600' },
  sent: { label: 'Enviada', cls: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'Aceptada', cls: 'bg-green-50 text-green-600' },
  rejected: { label: 'Rechazada', cls: 'bg-red-50 text-red-600' },
};

// Recuadro con el resumen de una cotización (total, comisión, estatus, fechas).
export default function QuoteSummaryCard({ quote, onOpen, onDelete }) {
  const { data } = useQuery({
    queryKey: ['quoteSummary', quote.id],
    queryFn: async () => {
      const days = await supabaseAPI.entities.QuoteDay.filter({ quote_id: quote.id });
      const ids = days.map(d => d.id);
      let services = [];
      if (ids.length) {
        const all = await supabaseAPI.entities.QuoteService.list();
        services = all.filter(s => ids.includes(s.quote_day_id));
      }
      const assembled = days.map(d => ({ ...d, services: services.filter(s => s.quote_day_id === d.id) }));
      return totals(resolveOptions(assembled));
    },
    refetchOnWindowFocus: false,
  });
  const st = STATUS[quote.status] || STATUS.draft;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onOpen(quote)} className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            <span className="text-[11px] text-stone-400">v{quote.version}</span>
          </div>
          <h4 className="font-semibold text-stone-800 truncate">{quote.trip_name || 'Cotización'}</h4>
          <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
            {quote.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(quote.start_date, 'd MMM', { locale: es })}{quote.end_date ? ` – ${formatDate(quote.end_date, 'd MMM', { locale: es })}` : ''}
              </span>
            )}
            {quote.pax ? <span className="flex items-center gap-1"><Users className="w-3 h-3" />{quote.pax}</span> : null}
          </div>
        </button>
        <button onClick={() => onDelete(quote)} title="Eliminar" className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <button onClick={() => onOpen(quote)} className="w-full flex items-end justify-between mt-3 pt-3 border-t border-stone-100 text-left">
        <div>
          <p className="text-[10px] text-stone-400">Total</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#2E442A' }}>
            {data ? money(data.sum) : <Loader2 className="w-4 h-4 animate-spin inline" />}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-stone-400">Comisión</p>
          <p className="text-sm font-semibold text-stone-600 tabular-nums">{data ? money(data.commission) : '—'}</p>
        </div>
      </button>
    </div>
  );
}
