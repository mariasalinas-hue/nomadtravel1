import { Plane } from 'lucide-react';
import CityPicker from '@/components/quote/CityPicker';

const GAP = 12;      // separación entre filas (coincide con rowGap)
const NODE_Y = 22;   // altura del nodo, alineado con el encabezado del día
const RAIL_X = 26;   // centro del riel de puntos (a la derecha de la barra del hotel)

// Riel vertical (por día): línea que conecta los días, nodo (dorado si hay ciudad),
// cruce entre ciudades distintas y la ciudad del día (editable). La barra del hotel
// va aparte (StayBar), a la izquierda de los puntos.
export default function DayRail({ index, total, city, nextCity, onCityChange }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const crossing = city && nextCity && city !== nextCity;
  const atX = { left: RAIL_X, transform: 'translateX(-50%)' };
  const line = 'absolute w-[2px] bg-stone-200';

  return (
    <div className="relative w-full h-full">
      {/* Línea base (mitades para rematar limpio en extremos) */}
      {!isFirst && <div className={line} style={{ ...atX, top: 0, height: NODE_Y }} />}
      {!isLast && <div className={line} style={{ ...atX, top: NODE_Y, bottom: -GAP }} />}

      {/* Nodo (igual que los demás: dorado si hay ciudad) */}
      <span className="absolute rounded-full border-2 z-10"
        style={{ ...atX, top: NODE_Y - 6, width: 12, height: 12, background: city ? '#C9A84C' : '#fff', borderColor: city ? '#C9A84C' : '#d6d3d1' }} />

      {/* Cruce (traslado entre ciudades) */}
      {crossing && (
        <div className="absolute z-10 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center" style={{ ...atX, bottom: -GAP - 2 }}>
          <Plane className="w-2.5 h-2.5 text-stone-400 rotate-90" />
        </div>
      )}

      {/* Ciudad del día (editable) */}
      <div className="absolute" style={{ left: RAIL_X + 16, right: 0, top: NODE_Y - 13 }}>
        <CityPicker value={city || ''} onChange={onCityChange} placeholder="＋ ciudad / en ruta" />
      </div>
    </div>
  );
}
