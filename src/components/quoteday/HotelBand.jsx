import { Hotel } from 'lucide-react';
import { money } from '@/lib/quoteEngine';

// Barra que cruza los días que cubre un hotel multinoche (estilo Tern).
// Las estancias que se traslapan se acomodan en "carriles" para no encimarse.
export default function HotelBand({ stays, count, colWidth = 272, gap = 16, onPick }) {
  if (!stays?.length) return null;
  const step = colWidth + gap;
  const width = count * colWidth + (count - 1) * gap;

  // Asignar carril (fila) a cada estancia evitando traslapes.
  const lanes = []; // lanes[l] = último índice ocupado
  const placed = stays
    .slice()
    .sort((a, b) => a.startIndex - b.startIndex)
    .map((s) => {
      const end = s.startIndex + s.span - 1;
      let lane = lanes.findIndex((lastEnd) => s.startIndex > lastEnd);
      if (lane === -1) { lane = lanes.length; lanes.push(end); } else { lanes[lane] = end; }
      return { ...s, lane };
    });
  const laneCount = lanes.length;

  return (
    <div className="relative mb-2" style={{ width, height: laneCount * 34 }}>
      {placed.map(({ service, startIndex, span, lane }) => {
        const nights = Number(service.nights) || span;
        return (
          <button
            key={service.id}
            onClick={() => onPick?.(startIndex)}
            title={`${service.name || 'Hospedaje'} · ${nights} noche${nights > 1 ? 's' : ''}`}
            className="absolute flex items-center gap-2 h-[28px] px-3 rounded-full border text-xs font-medium text-emerald-800 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors overflow-hidden"
            style={{ left: startIndex * step, width: span * colWidth + (span - 1) * gap, top: lane * 34 }}
          >
            <Hotel className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
            <span className="truncate">{service.name || 'Hospedaje'}</span>
            <span className="ml-auto flex-shrink-0 text-[10px] text-emerald-600/80">
              {nights} noche{nights > 1 ? 's' : ''}{Number(service.gross) > 0 ? ` · ${money(service.gross)}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
