import { MapPin, Hotel, Plane, ChevronDown } from 'lucide-react';
import { money } from '@/lib/quoteEngine';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import CityPicker from '@/components/quote/CityPicker';

// Tramo de ciudad en la vista vertical: encabezado grande con la ciudad (editable),
// las fechas y el hotel de esa ciudad; abajo van los días de ese tramo.
export default function CitySegment({ city, startDate, endDate, hotels = [], onSetCity, children }) {
  const enRuta = !city;
  const primary = hotels[0];
  const extra = hotels.length - 1;
  const hotelSum = hotels.reduce((a, h) => a + (Number(h.gross) || 0), 0);
  const dr = startDate
    ? (startDate === endDate ? formatDate(startDate, "d MMM", { locale: es }) : `${formatDate(startDate, "d MMM", { locale: es })} – ${formatDate(endDate, "d MMM", { locale: es })}`)
    : '';

  return (
    <section className="rounded-2xl border border-stone-200 overflow-hidden bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-100"
        style={{ background: enRuta ? '#faf9f7' : 'linear-gradient(90deg, rgba(46,68,42,0.06), transparent)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: enRuta ? '#f5f5f4' : 'rgba(46,68,42,0.10)' }}>
          {enRuta ? <Plane className="w-5 h-5 text-stone-400 rotate-90" /> : <MapPin className="w-5 h-5" style={{ color: '#2E442A' }} />}
        </div>

        <div className="min-w-0">
          <CityPicker
            value={city} onChange={onSetCity}
            trigger={
              <button type="button" className="group/city flex items-center gap-1.5 text-left max-w-full" title="Elegir ciudad">
                <span className="text-xl font-bold leading-tight truncate" style={{ fontFamily: 'Playfair Display, serif', color: enRuta ? '#78716c' : '#2E442A' }}>
                  {city || 'En ruta'}
                </span>
                <ChevronDown className="w-4 h-4 text-stone-300 opacity-0 group-hover/city:opacity-100 flex-shrink-0" />
              </button>
            }
          />
          {dr && <p className="text-[11px] text-stone-400 mt-0.5">{dr}</p>}
        </div>

        <div className="ml-auto text-right flex-shrink-0 pl-3">
          {primary ? (
            <>
              <p className="text-sm font-medium text-stone-700 flex items-center justify-end gap-1.5">
                <Hotel className="w-3.5 h-3.5 text-emerald-600" /> {primary.name || 'Hotel'}{extra > 0 ? ` +${extra}` : ''}
              </p>
              <p className="text-[11px] text-stone-400">{hotelSum > 0 ? money(hotelSum) : 'precio pendiente'}</p>
            </>
          ) : !enRuta ? (
            <span className="text-[11px] text-amber-500">Sin hospedaje</span>
          ) : null}
        </div>
      </header>

      <div className="p-2.5 space-y-2.5 bg-stone-50/40">
        {children}
      </div>
    </section>
  );
}
