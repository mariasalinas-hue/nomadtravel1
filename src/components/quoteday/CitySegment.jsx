import { MapPin, Hotel, Plane, ChevronDown } from 'lucide-react';
import { money } from '@/lib/quoteEngine';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import CityPicker from '@/components/quote/CityPicker';

// Tramo de ciudad (mismo diseño en vertical y horizontal): encabezado con la ciudad
// (editable y clara) y el hotel de esa ciudad en una raya verde clara; abajo/al lado
// van los días del tramo.
export default function CitySegment({ city, startDate, endDate, hotels = [], onSetCity, horizontal, children }) {
  const enRuta = !city;
  const primary = hotels[0];
  const extra = hotels.length - 1;
  const hotelSum = hotels.reduce((a, h) => a + (Number(h.gross) || 0), 0);
  const dr = startDate
    ? (startDate === endDate ? formatDate(startDate, "d MMM", { locale: es }) : `${formatDate(startDate, "d MMM", { locale: es })} – ${formatDate(endDate, "d MMM", { locale: es })}`)
    : '';

  return (
    <section className={`rounded-2xl border border-stone-200 overflow-hidden bg-white ${horizontal ? 'flex-shrink-0' : ''}`}>
      <header className="px-3 py-2.5 border-b border-stone-100"
        style={{ background: enRuta ? '#faf9f7' : 'linear-gradient(90deg, rgba(46,68,42,0.06), transparent)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: enRuta ? '#f5f5f4' : 'rgba(46,68,42,0.10)' }}>
            {enRuta ? <Plane className="w-4.5 h-4.5 text-stone-400 rotate-90" /> : <MapPin className="w-4.5 h-4.5" style={{ color: '#2E442A' }} />}
          </div>
          <div className="min-w-0 flex-1">
            <CityPicker
              value={city} onChange={onSetCity}
              trigger={
                <button type="button" className="group/city flex items-center gap-1.5 text-left max-w-full" title="Elegir ciudad">
                  <span className="text-lg font-bold leading-tight truncate" style={{ fontFamily: 'Playfair Display, serif', color: enRuta ? '#78716c' : '#2E442A' }}>
                    {city || 'En ruta'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-stone-300 opacity-0 group-hover/city:opacity-100 flex-shrink-0" />
                </button>
              }
            />
          </div>
          {dr && <span className="text-[11px] text-stone-400 flex-shrink-0">{dr}</span>}
        </div>

        {/* Hotel de la ciudad: raya clara */}
        {primary ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
            <Hotel className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
            <span className="truncate font-medium">{primary.name || 'Hotel'}{extra > 0 ? ` +${extra}` : ''}</span>
            <span className="ml-auto flex-shrink-0 tabular-nums">{hotelSum > 0 ? money(hotelSum) : 'pendiente'}</span>
          </div>
        ) : !enRuta ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-2.5 py-1.5 text-xs text-amber-600">
            <Hotel className="w-3.5 h-3.5 flex-shrink-0" /> Sin hospedaje
          </div>
        ) : null}
      </header>

      <div className={`p-2.5 bg-stone-50/40 ${horizontal ? 'flex gap-3 items-start' : 'space-y-2.5'}`}>
        {children}
      </div>
    </section>
  );
}
