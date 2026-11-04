import { Plane } from 'lucide-react';
import CityPicker from '@/components/quote/CityPicker';

// Línea del tiempo alineada con las columnas: un nodo por día donde eliges la
// ciudad, conectados por una línea. Entre días con ciudad distinta se marca un
// "cruce" (traslado/vuelo); los días sin ciudad se ven "en ruta".
export default function QuoteTimeline({ days, onCityChange, colWidth = 272, gap = 16 }) {
  if (!days?.length) return null;
  const step = colWidth + gap;
  const width = days.length * colWidth + (days.length - 1) * gap;
  const center = (i) => i * step + colWidth / 2;
  const lineY = 13;

  return (
    <div className="relative mb-2" style={{ width, height: 70 }}>
      {/* Línea base */}
      {days.length > 1 && (
        <div className="absolute h-[2px] bg-stone-200" style={{ left: center(0), width: center(days.length - 1) - center(0), top: lineY }} />
      )}

      {/* Cruces (traslado entre ciudades) */}
      {days.slice(0, -1).map((d, i) => {
        const a = d.city, b = days[i + 1]?.city;
        if (!a || !b || a === b) return null;
        const x = (center(i) + center(i + 1)) / 2;
        return (
          <div key={`x${i}`} className="absolute flex items-center justify-center" style={{ left: x - 10, top: lineY - 9, width: 20, height: 20 }}>
            <div className="w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center">
              <Plane className="w-2.5 h-2.5 text-stone-400 rotate-45" />
            </div>
          </div>
        );
      })}

      {/* Nodos por día */}
      {days.map((d, i) => (
        <div key={d.id} className="absolute flex flex-col items-center" style={{ left: center(i) - colWidth / 2, width: colWidth, top: 0 }}>
          <span className={`w-[11px] h-[11px] rounded-full border-2 ${d.city ? 'bg-[#C9A84C] border-[#C9A84C]' : 'bg-white border-stone-300'}`} style={{ marginTop: lineY - 5 }} />
          <div className="mt-1.5 max-w-full px-2">
            {d.city
              ? <CityPicker value={d.city} onChange={(v) => onCityChange(d.id, v)} />
              : <CityPicker value="" onChange={(v) => onCityChange(d.id, v)} placeholder="＋ ciudad / en ruta" />}
          </div>
        </div>
      ))}
    </div>
  );
}
