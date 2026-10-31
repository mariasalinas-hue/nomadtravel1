import { Hotel, Plane, Compass, Car, Train, Package, Ship, Briefcase, GripVertical, Star } from 'lucide-react';
import { money } from '@/lib/quoteEngine';

// Ícono + acento por tipo (design system del CRM).
export const TYPE_UI = {
  hotel:    { label: 'Hospedaje', Icon: Hotel,   accent: '#3f6b58', chip: 'bg-emerald-50 text-emerald-600' },
  vuelo:    { label: 'Vuelo',     Icon: Plane,   accent: '#5d6b8a', chip: 'bg-sky-50 text-sky-600' },
  crucero:  { label: 'Crucero',   Icon: Ship,    accent: '#4a7a8c', chip: 'bg-cyan-50 text-cyan-600' },
  tour:     { label: 'Tour',      Icon: Compass, accent: '#b8955a', chip: 'bg-amber-50 text-amber-600' },
  traslado: { label: 'Traslado',  Icon: Car,     accent: '#8a6b5d', chip: 'bg-orange-50 text-orange-600' },
  tren:     { label: 'Tren',      Icon: Train,   accent: '#6f6f73', chip: 'bg-stone-100 text-stone-600' },
  dmc:      { label: 'DMC',       Icon: Briefcase, accent: '#7a6b8a', chip: 'bg-indigo-50 text-indigo-600' },
  otro:     { label: 'Otro',      Icon: Package, accent: '#8f8a7f', chip: 'bg-stone-100 text-stone-500' },
};

// Tarjeta compacta de una sola línea: acento + ícono + nombre + precio.
// Lo técnico (comisión, foto, campos) vive en la ventana de edición.
export default function ServiceCard({ service, onOpen, dragHandleProps, showOptionBadge }) {
  const ui = TYPE_UI[service?.type] || TYPE_UI.otro;
  const gross = Number(service.gross) || 0;
  const isHotel = service.type === 'hotel';
  const sub = isHotel ? `${service.nights || 1}n${service.rooms ? `·${service.rooms}h` : ''}` : '';

  return (
    <div className="group flex items-center gap-1 rounded-lg border border-stone-100 bg-white hover:border-stone-200 hover:shadow-sm transition-all pr-2" style={{ borderLeft: `3px solid ${ui.accent}` }}>
      <span {...(dragHandleProps || {})} className="text-stone-200 group-hover:text-stone-400 cursor-grab active:cursor-grabbing flex-shrink-0 pl-0.5">
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <button onClick={() => onOpen?.(service)} className="flex-1 min-w-0 flex items-center gap-2 text-left py-1.5">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${ui.chip}`}>
          <ui.Icon className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 min-w-0">
          {showOptionBadge && service.option_label && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-400 leading-none mb-0.5">
              {service.is_selected && <Star className="w-2.5 h-2.5 text-[#C9A84C] fill-[#C9A84C]" />}{service.option_label}
            </span>
          )}
          <span className="block text-[13px] font-medium text-stone-800 truncate leading-tight">
            {service.name || <span className="text-stone-400 italic font-normal">Sin nombre</span>}
            {sub && <span className="text-stone-400 font-normal"> · {sub}</span>}
          </span>
        </span>
        <span className={`text-[13px] font-semibold tabular-nums flex-shrink-0 ${gross ? 'text-stone-700' : 'text-orange-400'}`}>
          {gross ? money(gross) : '—'}
        </span>
      </button>
    </div>
  );
}
