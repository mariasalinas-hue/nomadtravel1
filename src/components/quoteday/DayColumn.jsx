import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, Copy, X, Hotel, Plus, Star } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import ServiceCard, { TYPE_UI } from './ServiceCard';
import { TYPE_ORDER, groupServices } from '@/lib/quoteEngine';

export default function DayColumn({
  day, index, cover,
  onToggleFree, onMoveDay, onDuplicateDay, onDeleteDay,
  onAddService, onOpenService, onSelectOption,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const services = (day.services || []).filter(s => s && s.id);
  const { singles, groups } = groupServices(services);

  return (
    <div className={`w-[272px] flex-shrink-0 flex flex-col rounded-2xl border border-stone-200 bg-white ${day.is_free ? 'opacity-80' : ''}`}>
      {/* Encabezado */}
      <div className="px-3 pt-3 pb-2 border-b border-stone-100">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#C9A84C' }}>
            Día {index + 1} · <span className="text-stone-400 font-medium normal-case">{day.date ? formatDate(day.date, "EEE d MMM", { locale: es }) : ''}</span>
          </span>
          <div className="flex items-center gap-0.5 text-stone-300">
            <Tool onClick={() => onMoveDay(-1)} title="Mover ←"><ArrowLeft className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={() => onMoveDay(1)} title="Mover →"><ArrowRight className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={onDuplicateDay} title="Duplicar día"><Copy className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={onDeleteDay} title="Eliminar día"><X className="w-3.5 h-3.5" /></Tool>
          </div>
        </div>
        <div className="flex justify-end mt-1.5">
          <button onClick={onToggleFree}
            className={`text-[10px] px-2 py-1 rounded-full border flex-shrink-0 ${day.is_free ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-stone-400 border-stone-200 hover:border-stone-300'}`}>
            Día libre
          </button>
        </div>
      </div>

      {/* Servicios */}
      <div className="flex-1 px-3 py-3 min-h-[80px]">
        {cover && (
          <div className="rounded-xl border border-dashed border-emerald-200/70 bg-emerald-50/30 px-3 py-1.5 mb-2 flex items-center gap-2 text-[11px] text-emerald-600/80">
            <Hotel className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Noche {cover.night} de {cover.of}</span>
          </div>
        )}

        <Droppable droppableId={day.id} type="service">
          {(provided, snapshot) => (
            <div ref={provided.innerRef} {...provided.droppableProps}
              className={`space-y-2 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-amber-50/40 outline-dashed outline-1 outline-amber-200' : ''} min-h-[8px]`}>
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

        {/* Grupos de opciones (Opción 1 / Opción 2) */}
        {groups.map((g) => (
          <div key={g.option_group} className="mt-2 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400 px-1 pb-1.5">Opciones · {TYPE_UI[g.services[0]?.type]?.label || ''}</p>
            <div className="space-y-1.5">
              {g.services.map((s) => (
                <div key={s.id} className="flex items-stretch gap-1">
                  <button onClick={() => onSelectOption?.(s.id)} title={s.is_selected ? 'Opción elegida' : 'Marcar como elegida'}
                    className="flex-shrink-0 w-6 flex items-center justify-center rounded-lg hover:bg-stone-100">
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
          <p className="text-xs text-stone-300 py-2 text-center italic">Sin servicios</p>
        )}
      </div>

      {/* Agregar servicio: un solo botón "+" con menú de tipos */}
      <div className="px-3 pb-3 pt-1 border-t border-stone-100">
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1.5 text-xs text-stone-500 py-2 rounded-lg border border-dashed border-stone-200 hover:border-stone-400 hover:text-stone-800 transition-colors">
              <Plus className="w-4 h-4" /> Agregar servicio
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-1.5 w-48" align="center">
            <div className="grid grid-cols-1">
              {TYPE_ORDER.map(t => {
                const ui = TYPE_UI[t];
                return (
                  <button key={t} onClick={() => { onAddService(t); setAddOpen(false); }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-700 hover:bg-stone-100 text-left">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ui.chip}`}><ui.Icon className="w-3.5 h-3.5" /></span>
                    {ui.label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Tool({ children, onClick, title }) {
  return <button onClick={onClick} title={title} className="p-1 rounded hover:bg-stone-100 hover:text-stone-600">{children}</button>;
}
