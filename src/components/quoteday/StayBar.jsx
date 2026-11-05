import { money } from '@/lib/quoteEngine';

const NODE_Y = 22;

// Barra vertical del hotel: abarca (en la rejilla) todas las filas/días que cubre
// la estancia, con el nombre del hotel girado en vertical.
export default function StayBar({ service, startIndex, span }) {
  const nights = Number(service.nights) || span;
  const price = Number(service.gross) || 0;
  const label = `${service.name || 'Hotel'} · ${nights} noche${nights > 1 ? 's' : ''}${price ? ` · ${money(price)}` : ''}`;

  return (
    <div style={{ gridColumn: 1, gridRow: `${startIndex + 1} / ${startIndex + span + 1}`, position: 'relative', zIndex: 0, pointerEvents: 'none' }}>
      <div className="absolute rounded-full border border-emerald-300 bg-emerald-100 flex items-center justify-center overflow-hidden"
        style={{ left: 2, width: 14, top: NODE_Y - 4, bottom: 6 }}>
        <span className="text-[10px] font-semibold text-emerald-800 whitespace-nowrap tracking-wide px-0.5"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
