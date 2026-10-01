import { TYPE_ORDER, money, commissionOf, resolveOptions, SERVICE_TYPES } from '@/lib/quoteEngine';
import { TYPE_UI } from './ServiceCard';
import { Star } from 'lucide-react';

// Vista "Servicios": todo lo cotizado agrupado por tipo (hoteles, vuelos, tours…).
// Las opciones no elegidas se muestran en gris y no suman al subtotal.
export default function QuoteServicesView({ days, onOpenService }) {
  const effective = new Set(
    resolveOptions(days).flatMap(d => (d.services || []).map(s => s.id))
  );

  // items por tipo, con su día.
  const byType = {};
  TYPE_ORDER.forEach(t => { byType[t] = []; });
  days.forEach((d, i) => (d.services || []).forEach(s => {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push({ ...s, dayIndex: i });
  }));

  const grand = { sum: 0, commission: 0 };
  TYPE_ORDER.forEach(t => (byType[t] || []).forEach(s => {
    if (effective.has(s.id)) { grand.sum += Number(s.gross) || 0; grand.commission += commissionOf(s); }
  }));

  const typesWithItems = TYPE_ORDER.filter(t => (byType[t] || []).length);

  if (!typesWithItems.length) {
    return <p className="text-sm text-stone-400 py-10 text-center">Aún no hay servicios cotizados.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {typesWithItems.map(t => {
        const ui = TYPE_UI[t];
        const items = byType[t];
        const subtotal = items.filter(s => effective.has(s.id)).reduce((a, s) => a + (Number(s.gross) || 0), 0);
        return (
          <section key={t} className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${ui.chip}`}><ui.Icon className="w-4 h-4" /></span>
              <h3 className="text-sm font-semibold text-stone-800">{SERVICE_TYPES[t]?.label || t}</h3>
              <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: '#2E442A' }}>{money(subtotal)}</span>
            </div>
            <div className="divide-y divide-stone-50">
              {items.map(s => {
                const counts = effective.has(s.id);
                return (
                  <button key={s.id} onClick={() => onOpenService?.(s)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 ${counts ? '' : 'opacity-55'}`}>
                    <span className="text-[11px] text-stone-400 w-12 flex-shrink-0">Día {s.dayIndex + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate flex items-center gap-1.5">
                        {s.option_label && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-400">{s.is_selected && <Star className="w-2.5 h-2.5 text-[#C9A84C] fill-[#C9A84C]" />}{s.option_label}</span>}
                        {s.name || <span className="text-stone-400 italic">Sin nombre</span>}
                      </p>
                      {s.supplier && <p className="text-[11px] text-stone-400 truncate">{s.supplier}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-stone-800">{Number(s.gross) ? money(s.gross) : '—'}</p>
                      {Number(s.gross) > 0 && <p className="text-[10px] text-stone-400">Com. {money(commissionOf(s))}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="rounded-2xl p-5 text-white flex items-end justify-between" style={{ background: 'linear-gradient(135deg, #2E442A, #3f6b58)' }}>
        <div>
          <p className="text-white/70 text-sm">Total</p>
          <p className="text-white/60 text-xs mt-0.5">Tu comisión: {money(grand.commission)}</p>
        </div>
        <p className="text-3xl font-bold tabular-nums" style={{ fontFamily: 'Playfair Display, serif' }}>{money(grand.sum)}</p>
      </div>
    </div>
  );
}
