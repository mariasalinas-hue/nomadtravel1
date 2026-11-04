import { Plane, Hotel } from 'lucide-react';
import { money } from '@/lib/quoteEngine';
import CityPicker from '@/components/quote/CityPicker';

const GAP = 12;      // separación entre filas (coincide con mb-3)
const NODE_Y = 22;   // altura del nodo, alineado con el encabezado del día
const RAIL_X = 11;   // centro del riel gráfico

// Riel vertical: línea que conecta los días, nodo por día, cinta verde del hotel
// multinoche, cruce (avión) entre ciudades distintas, y a la derecha la ciudad
// (editable) y, al inicio de la estancia, el hotel en una barra verde clara.
export default function DayRail({ index, total, city, nextCity, stay, onCityChange }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const crossing = city && nextCity && city !== nextCity;
  const stayColor = '#3f6b58';
  const atX = { left: RAIL_X, transform: 'translateX(-50%)' };
  const line = 'absolute w-[2px] bg-stone-200';
  const BAR_W = 10;
  const barColor = 'rgba(63,107,88,0.55)';
  const nights = stay?.service ? (Number(stay.service.nights) || null) : null;
  const price = stay?.service ? (Number(stay.service.gross) || 0) : 0;

  return (
    <div className="relative w-[190px] flex-shrink-0 self-stretch">
      {/* Línea base (mitades para rematar limpio en extremos) */}
      {!isFirst && <div className={line} style={{ ...atX, top: 0, height: NODE_Y }} />}
      {!isLast && <div className={line} style={{ ...atX, top: NODE_Y, bottom: -GAP }} />}

      {/* Barra del hotel multinoche: abarca todas las noches que cubre */}
      {stay && !stay.isStart && (
        <div className="absolute" style={{ ...atX, width: BAR_W, top: 0, height: NODE_Y, background: barColor, borderBottomLeftRadius: stay.isEnd ? BAR_W : 0, borderBottomRightRadius: stay.isEnd ? BAR_W : 0 }} />
      )}
      {stay && !stay.isEnd && (
        <div className="absolute" style={{ ...atX, width: BAR_W, top: stay.isStart ? NODE_Y : 0, bottom: -GAP, background: barColor, borderTopLeftRadius: stay.isStart ? BAR_W : 0, borderTopRightRadius: stay.isStart ? BAR_W : 0 }} />
      )}

      {/* Nodo */}
      <span className="absolute rounded-full border-2 z-10"
        style={{ ...atX, top: NODE_Y - 6, width: 12, height: 12, background: stay ? stayColor : (city ? '#C9A84C' : '#fff'), borderColor: stay ? stayColor : (city ? '#C9A84C' : '#d6d3d1') }} />

      {/* Cruce (traslado entre ciudades) */}
      {crossing && (
        <div className="absolute z-10 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center" style={{ ...atX, bottom: -GAP - 2 }}>
          <Plane className="w-2.5 h-2.5 text-stone-400 rotate-90" />
        </div>
      )}

      {/* Etiquetas: ciudad (editable) + hotel */}
      <div className="absolute" style={{ left: 26, right: 0, top: NODE_Y - 13 }}>
        <CityPicker value={city || ''} onChange={onCityChange} placeholder="＋ ciudad / en ruta" />
        {stay?.isStart && (
          <div className="mt-1 flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] text-emerald-800">
            <Hotel className="w-3 h-3 flex-shrink-0 text-emerald-600" />
            <span className="truncate font-medium">{stay.service.name || 'Hotel'}</span>
            <span className="ml-auto flex-shrink-0 text-emerald-600/80 tabular-nums">{nights ? `${nights}n` : ''}{price ? ` · ${money(price)}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
