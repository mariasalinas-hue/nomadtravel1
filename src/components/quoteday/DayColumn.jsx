import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, Copy, Trash2, Hotel, Plus, Star, MoreVertical, Moon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ServiceCard, { TYPE_UI } from './ServiceCard';
import { TYPE_ORDER, groupServices } from '@/lib/quoteEngine';

export default function DayColumn({
  day, index, cover, vertical,
  onToggleFree, onMoveDay, onDuplicateDay, onDeleteDay,
  onAddService, onOpenService, onSelectOption,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const services = (day.services || []).filter(s => s && s.id);
  const { singles, groups } = groupServices(services);
  const close = (fn) => () => { setMenuOpen(false); fn(); };

  return (
    <div className={`group/col flex-shrink-0 flex flex-col rounded-2xl border border-stone-200 bg-white ${vertical ? 'w-full' : 'w-[248px]'} ${day.is_free ? 'bg-amber-50/20' : ''}`}>
      {/* Encabezado minimal */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
        <div className="min-w-0 flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: '#C9A84C' }}>Día {index + 1}</span>
          <span className="text-[11px] text-stone-400 truncate">{day.date ? formatDate(day.date, "EEE d MMM", { locale: es }) : ''}</span>
          {day.is_free && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">libre</span>}
        </div>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button className="flex-shrink-0 p-1 -mr-1 rounded text-stone-300 opacity-0 group-hover/col:opacity-100 hover:bg-stone-100 hover:text-stone-600 transition-opacity" title="Opciones del día">
              <MoreVertical className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-1 w-44" align="end">
            <MenuItem onClick={close(() => onMoveDay(-1))} icon={ArrowLeft}>Mover a la izquierda</MenuItem>
            <MenuItem onClick={close(() => onMoveDay(1))} icon={ArrowRight}>Mover a la derecha</MenuItem>
            <MenuItem onClick={close(onDuplicateDay)} icon={Copy}>Duplicar día</MenuItem>
            <MenuItem onClick={close(onToggleFree)} icon={Moon}>{day.is_free ? 'Quitar día libre' : 'Marcar día libre'}</MenuItem>
            <div className="h-px bg-stone-100 my-1" />
            <MenuItem onClick={close(onDeleteDay)} icon={Trash2} danger>Eliminar día</MenuItem>
          </PopoverContent>
        </Popover>
      </div>

      {/* Servicios */}
      <div className="flex-1 px-2.5 pb-2 min-h-[60px]">
        {cover && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 text-[10px] text-emerald-600/80">
            <Hotel className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Noche {cover.night} de {cover.of}</span>
          </div>
        )}

        <Droppable droppableId={day.id} type="service">
          {(provided, snapshot) => (
            <div ref={provided.innerRef} {...provided.droppableProps}
              className={`space-y-1.5 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-amber-50/40 outline-dashed outline-1 outline-amber-200' : ''} min-h-[8px]`}>
              {singles.map((s, i) => (
                <Draggable key={s.id} draggableId={s.id} index={i}>
                  {(dp) => (
                    <div ref={dp.innerRef} {...dp.draggableProps}>
                      <ServiceCard service={s} onOpen={onOpenService} dragHandleProps={dp.dragHandleProps} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Grupos de opciones */}
        {groups.map((g) => (
          <div key={g.option_group} className="mt-1.5 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 px-1 pb-1">Opciones · {TYPE_UI[g.services[0]?.type]?.label || ''}</p>
            <div className="space-y-1">
              {g.services.map((s) => (
                <div key={s.id} className="flex items-stretch gap-1">
                  <button onClick={() => onSelectOption?.(s.id)} title={s.is_selected ? 'Opción elegida' : 'Marcar como elegida'}
                    className="flex-shrink-0 w-5 flex items-center justify-center rounded hover:bg-stone-100">
                    <Star className={`w-3.5 h-3.5 ${s.is_selected ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-stone-300'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <ServiceCard service={s} onOpen={onOpenService} showOptionBadge />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!services.length && !cover && !day.is_free && (
          <p className="text-[11px] text-stone-300 py-3 text-center italic">Vacío</p>
        )}
      </div>

      {/* Agregar servicio: botón discreto */}
      <div className="px-2.5 pb-2.5">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1 text-xs text-stone-400 py-1.5 rounded-lg hover:bg-stone-50 hover:text-stone-700 transition-colors">
              <Plus className="w-4 h-4" /> servicio
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-1.5 w-48" align="center">
            {TYPE_ORDER.map(t => {
              const ui = TYPE_UI[t];
              return (
                <button key={t} onClick={() => { onAddService(t); setAddOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-100 text-left">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ui.chip}`}><ui.Icon className="w-3.5 h-3.5" /></span>
                  {ui.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick, icon: Icon, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left ${danger ? 'text-red-500 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-100'}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {children}
    </button>
  );
}
