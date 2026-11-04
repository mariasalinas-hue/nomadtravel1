import { Plane } from 'lucide-react';

const GAP = 12;      // separación entre filas (coincide con space-y-3)
const NODE_Y = 22;   // altura del nodo, alineado con el encabezado del día

// Riel vertical para el planner en modo vertical: línea que conecta los días,
// nodo por día (dorado si tiene ciudad), cinta verde para el hotel multinoche
// y un "cruce" (avión) entre días con ciudad distinta.
export default function DayRail({ index, total, city, nextCity, stay }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const crossing = city && nextCity && city !== nextCity;
  const line = 'absolute left-1/2 -translate-x-1/2 w-[2px] bg-stone-200';
  const ribbon = 'absolute left-1/2 -translate-x-1/2 w-[6px] rounded-full';
  const stayColor = '#3f6b58';

  return (
    <div className="relative w-9 flex-shrink-0 self-stretch">
      {/* Línea base (mitades para rematar limpio en extremos) */}
      {!isFirst && <div className={line} style={{ top: 0, height: NODE_Y }} />}
      {!isLast && <div className={line} style={{ top: NODE_Y, bottom: -GAP }} />}

      {/* Cinta del hotel multinoche */}
      {stay && !stay.isStart && <div className={ribbon} style={{ top: 0, height: NODE_Y, background: `${stayColor}44` }} />}
      {stay && !stay.isEnd && <div className={ribbon} style={{ top: NODE_Y, bottom: -GAP, background: `${stayColor}44` }} />}

      {/* Nodo */}
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full border-2 z-10"
        style={{
          top: NODE_Y - 6, width: 12, height: 12,
          background: stay ? stayColor : (city ? '#C9A84C' : '#fff'),
          borderColor: stay ? stayColor : (city ? '#C9A84C' : '#d6d3d1'),
        }}
        title={stay ? (stay.service.name || 'Hospedaje') : (city || 'En ruta')}
      />

      {/* Cruce (traslado entre ciudades) */}
      {crossing && (
        <div className="absolute left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center" style={{ bottom: -GAP - 2 }}>
          <Plane className="w-2.5 h-2.5 text-stone-400 rotate-90" />
        </div>
      )}
    </div>
  );
}
