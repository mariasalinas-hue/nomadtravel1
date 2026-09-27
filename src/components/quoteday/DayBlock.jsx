import { Droppable, Draggable } from '@hello-pangea/dnd';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { ArrowUp, ArrowDown, Copy, X, Hotel } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ServiceCard, { TYPE_UI } from './ServiceCard';
import { TYPE_ORDER } from '@/lib/quoteEngine';

export default function DayBlock({
  day, index, pax, rules, cover,
  onCityChange, onToggleFree, onMoveDay, onDuplicateDay, onDeleteDay,
  onAddService, updateService, deleteService, duplicateService,
}) {
  const services = day.services || [];
  return (
    <div className={`flex gap-4 group ${day.is_free ? 'opacity-70' : ''}`}>
      {/* Columna timeline: línea + punto */}
      <div className="relative w-5 flex-shrink-0 flex justify-center">
        <div className="absolute top-0 bottom-0 w-px bg-stone-200" />
        <div className="relative z-10 w-3 h-3 rounded-full mt-1.5 ring-4 ring-stone-50" style={{ background: '#C9A84C' }} />
      </div>

      {/* Contenido del día */}
      <div className="flex-1 min-w-0 pb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: '#C9A84C' }}>
            Día {index + 1}
          </span>
          <span className="text-[11px] text-stone-400 flex-shrink-0">{day.date ? formatDate(day.date, "EEE d 'de' MMM", { locale: es }) : ''}</span>
          <Input defaultValue={day.city || ''} placeholder="Ciudad" onBlur={(e) => onCityChange(e.target.value)}
            className="font-semibold text-stone-800 border-0 border-b border-transparent hover:border-stone-200 focus:border-[#C9A84C] rounded-none px-0 h-7 max-w-[200px]"
            style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px' }} />
          <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Tool onClick={() => onMoveDay(-1)} title="Subir"><ArrowUp className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={() => onMoveDay(1)} title="Bajar"><ArrowDown className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={onDuplicateDay} title="Duplicar día"><Copy className="w-3.5 h-3.5" /></Tool>
            <Tool onClick={onDeleteDay} title="Eliminar día"><X className="w-3.5 h-3.5" /></Tool>
          </div>
          <button onClick={onToggleFree}
            className={`text-[11px] px-2 py-1 rounded-full border flex-shrink-0 ${day.is_free ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-stone-400 border-stone-200 hover:border-stone-300'}`}>
            {day.is_free ? 'Día libre' : 'Libre'}
          </button>
        </div>

        {/* Referencia de hotel multinoche */}
        {cover && (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-2 mb-2 flex items-center gap-2 text-sm text-emerald-700">
            <Hotel className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{cover.service.name || 'Hotel'}</span>
            <span className="text-[11px] text-emerald-600/70 ml-auto flex-shrink-0">noche {cover.night} de {cover.of}</span>
          </div>
        )}

        <Droppable droppableId={day.id} type="service">
          {(provided, snapshot) => (
            <div ref={provided.innerRef} {...provided.droppableProps}
              className={`space-y-2 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-amber-50/40 outline-dashed outline-1 outline-amber-200' : ''} ${services.length ? '' : 'min-h-[8px]'}`}>
              {services.map((s, i) => (
                <Draggable key={s.id} draggableId={s.id} index={i}>
                  {(dp) => (
                    <div ref={dp.innerRef} {...dp.draggableProps}>
                      <ServiceCard
                        service={s} pax={pax} rules={rules}
                        dragHandleProps={dp.dragHandleProps}
                        onChange={(patch) => updateService(s.id, patch)}
                        onDelete={() => deleteService(s.id)}
                        onDuplicate={() => duplicateService(s.id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {!services.length && !cover && !day.is_free && (
          <p className="text-xs text-stone-300 py-1 italic">Sin servicios todavía.</p>
        )}

        {/* Agregar servicio por tipo */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {TYPE_ORDER.map(t => {
            const ui = TYPE_UI[t];
            return (
              <button key={t} onClick={() => onAddService(t)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full text-stone-500 hover:text-white transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ui.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <ui.Icon className="w-3 h-3" /> {ui.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tool({ children, onClick, title }) {
  return <button onClick={onClick} title={title} className="p-1 rounded text-stone-300 hover:bg-stone-100 hover:text-stone-600">{children}</button>;
}
