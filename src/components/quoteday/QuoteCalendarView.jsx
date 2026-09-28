import { parseLocalDate, formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { money, totals } from '@/lib/quoteEngine';
import { TYPE_UI } from './ServiceCard';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Vista calendario de la cotización: rejilla mensual con los días del viaje,
// su ciudad y los servicios. Click en un día abre el editor en ese día.
export default function QuoteCalendarView({ days, onPickDay }) {
  const byDate = {};
  days.forEach((d) => { if (d.date) byDate[d.date] = d; });

  const dates = days.map((d) => parseLocalDate(d.date)).filter(Boolean);
  if (!dates.length) return <p className="text-sm text-stone-400 p-6">Sin fechas para mostrar.</p>;
  const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));

  // Meses a renderizar (del mes de inicio al de fin)
  const months = [];
  let cur = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth(), 1);
  while (cur <= end) { months.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }

  const t = totals(days);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-stone-500">{days.length} días · {money(t.sum)} · comisión {money(t.commission)}</p>
      </div>
      <div className="space-y-8">
        {months.map((mDate) => {
          const y = mDate.getFullYear(), m = mDate.getMonth();
          const first = new Date(y, m, 1);
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const lead = first.getDay();
          const cells = [];
          for (let i = 0; i < lead; i++) cells.push(null);
          for (let dd = 1; dd <= daysInMonth; dd++) cells.push(dd);
          return (
            <div key={`${y}-${m}`}>
              <h3 className="text-lg font-bold mb-2 capitalize" style={{ color: '#2E442A', fontFamily: 'Playfair Display, serif' }}>
                {formatDate(new Date(y, m, 1), 'MMMM yyyy', { locale: es })}
              </h3>
              <div className="grid grid-cols-7 gap-1">
                {DOW.map((d) => <div key={d} className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-center py-1">{d}</div>)}
                {cells.map((dd, i) => {
                  if (!dd) return <div key={`e${i}`} />;
                  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
                  const day = byDate[iso];
                  if (!day) return <div key={iso} className="aspect-square rounded-lg border border-stone-100 bg-stone-50/40 p-1"><span className="text-[11px] text-stone-300">{dd}</span></div>;
                  const svcs = (day.services || []).filter((s) => s && s.id);
                  return (
                    <button key={iso} onClick={() => onPickDay(day.day_index)}
                      className={`aspect-square rounded-lg border p-1.5 text-left overflow-hidden hover:border-[#C9A84C] transition-colors ${day.is_free ? 'bg-amber-50/40 border-amber-100' : 'bg-white border-stone-200'}`}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-bold text-stone-700">{dd}</span>
                        <span className="text-[9px] text-stone-400">D{day.day_index + 1}</span>
                      </div>
                      {day.city && <p className="text-[10px] font-medium text-stone-600 truncate mt-0.5">{day.city}</p>}
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {svcs.slice(0, 6).map((s) => {
                          const ui = TYPE_UI[s.type] || TYPE_UI.otro;
                          return <span key={s.id} className="w-1.5 h-1.5 rounded-full" style={{ background: ui.accent }} title={ui.label} />;
                        })}
                      </div>
                      {day.is_free && !svcs.length && <p className="text-[9px] text-amber-500 mt-1">Libre</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
