import { Hotel, Plane, Compass, Car, Train, Package, Ship, Briefcase, GripVertical, Star } from 'lucide-react';
import { money, commissionOf } from '@/lib/quoteEngine';

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

// Tarjeta compacta: resume el servicio y abre la ventana de edición al hacer clic.
export default function ServiceCard({ service, onOpen, dragHandleProps, showOptionBadge }) {
  const ui = TYPE_UI[service?.type] || TYPE_UI.otro;
  const gross = Number(service.gross) || 0;
  const commission = commissionOf(service);
  const isHotel = service.type === 'hotel';

  const sub = isHotel
    ? `${service.nights || 1} noche${(service.nights || 1) > 1 ? 's' : ''}${service.rooms ? ` · ${service.rooms} hab` : ''}${service.breakfast ? ' · desayuno' : ''}`
    : (service.supplier || '');

  return (
    <div className="rounded-xl border border-stone-100 bg-white hover:border-stone-200 transition-colors overflow-hidden" style={{ borderLeft: `3px solid ${ui.accent}` }}>
      {service.meta?.image_url && (
        <img src={service.meta.image_url} alt="" className="w-full h-16 object-cover" />
      )}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span {...(dragHandleProps || {})} className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ui.chip}`}>
          <ui.Icon className="w-3.5 h-3.5" />
        </div>
        <button onClick={() => onOpen?.(service)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <div className="flex-1 min-w-0">
            {showOptionBadge && service.option_label && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-stone-400 mb-0.5">
                {service.is_selected && <Star className="w-2.5 h-2.5 text-[#C9A84C] fill-[#C9A84C]" />}
                {service.option_label}
              </span>
            )}
            <p className="text-sm font-medium text-stone-800 truncate">
              {service.name || <span className="text-stone-400 italic">Sin nombre</span>}
            </p>
            {sub && <p className="text-[11px] text-stone-400 truncate">{sub}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-semibold tabular-nums ${gross ? 'text-stone-800' : 'text-orange-500'}`}>{gross ? money(gross) : 'pendiente'}</p>
            {gross > 0 && <p className="text-[10px] text-stone-400 tabular-nums">Com. {money(commission)}</p>}
          </div>
        </button>
      </div>
    </div>
  );
}
