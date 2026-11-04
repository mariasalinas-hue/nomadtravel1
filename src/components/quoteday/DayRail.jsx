import { Plane } from 'lucide-react';
import CityPicker from '@/components/quote/CityPicker';

const GAP = 12;      // separación entre filas (coincide con rowGap)
const NODE_Y = 22;   // altura del nodo, alineado con el encabezado del día
const RAIL_X = 11;   // centro del riel gráfico

// Riel vertical (por día): línea que conecta los días, nodo, cruce (avión) entre
// ciudades distintas y la ciudad del día (editable). La barra del hotel multinoche
// se dibuja aparte (StayBar) para poder abarcar varias filas.
export default function DayRail({ index, total, city, nextCity, covered, onCityChange }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const crossing = city && nextCity && city !== nextCity;
  const atX = { left: RAIL_X, transform: 'translateX(-50%)' };
  const line = 'absolute w-[2px] bg-stone-200';

  return (
    <div className="relative w-full h-full">
      {/* Línea base (se oculta donde la barra del hotel ya conecta los días) */}
      {!isFirst && !covered && <div className={line} style={{ ...atX, top: 0, height: NODE_Y }} />}
      {!isLast && !covered && <div className={line} style={{ ...atX, top: NODE_Y, bottom: -GAP }} />}

      {/* Nodo */}
      <span className="absolute rounded-full border-2 z-10"
        style={{ ...atX, top: NODE_Y - 6, width: 12, height: 12, background: covered ? '#3f6b58' : (city ? '#C9A84C' : '#fff'), borderColor: covered ? '#3f6b58' : (city ? '#C9A84C' : '#d6d3d1') }} />

      {/* Cruce (traslado entre ciudades) */}
      {crossing && (
        <div className="absolute z-10 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center" style={{ ...atX, bottom: -GAP - 2 }}>
          <Plane className="w-2.5 h-2.5 text-stone-400 rotate-90" />
        </div>
      )}

      {/* Ciudad del día (editable) */}
      <div className="absolute" style={{ left: 28, right: 0, top: NODE_Y - 13 }}>
        <CityPicker value={city || ''} onChange={onCityChange} placeholder="＋ ciudad / en ruta" />
      </div>
    </div>
  );
}
