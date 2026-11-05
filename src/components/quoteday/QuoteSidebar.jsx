import { money, TYPE_ORDER, SERVICE_TYPES } from '@/lib/quoteEngine';

export default function QuoteSidebar({ totals, pax }) {
  const { byType, sum, commission } = totals;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">Total del grupo</p>
        <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: '#2E442A', fontFamily: 'Playfair Display, serif' }}>
          {money(sum)}<span className="text-base text-[#C9A84C] ml-1">USD</span>
        </p>
        <p className="text-xs text-stone-400 mt-1.5">{money(pax ? sum / pax : 0)} por persona · {pax} pasajeros</p>
      </div>

      {sum > 0 && (
        <div>
          {TYPE_ORDER.filter(k => byType[k]).map(k => (
            <div key={k} className="flex justify-between py-1.5 border-t border-stone-100 text-sm tabular-nums">
              <span className="text-stone-500">{SERVICE_TYPES[k]?.label || k}</span>
              <span className="font-medium text-stone-700">{money(byType[k])}</span>
            </div>
          ))}
          <div className="flex justify-between py-1.5 border-t-2 mt-0.5 text-sm font-semibold tabular-nums" style={{ borderColor: '#C9A84C' }}>
            <span style={{ color: '#2E442A' }}>Total</span>
            <span style={{ color: '#2E442A' }}>{money(sum)}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stone-100 bg-white p-3">
        <p className="text-[11px] text-stone-500">Comisión estimada de la agencia</p>
        <p className="text-xl font-bold tabular-nums" style={{ color: '#2E442A', fontFamily: 'Playfair Display, serif' }}>
          {money(commission)}
          {sum > 0 && <span className="text-xs font-normal text-stone-400 ml-2">{(commission / sum * 100).toFixed(1)}% del total</span>}
        </p>
      </div>
    </div>
  );
}
