import { Droppable, Draggable } from '@hello-pangea/dnd';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, Copy, X, Hotel } from 'lucide-react';
import ServiceCard, { TYPE_UI } from './ServiceCard';
import { TYPE_ORDER } from '@/lib/quoteEngine';
import CityPicker from '@/components/quote/CityPicker';

export default function DayColumn({
  day, index, pax, rules, cover,
  onCityChange, onToggleFree, onMoveDay, onDuplicateDay, onDeleteDay,
  onAddService, updateService, deleteService, duplicateService,
}) {
  const services = (day.services || []).filter(s => s && s.id);
  return (
    <div className={`w-[272px] flex-shrink-0 flex flex-col rounded-2xl border border-stone-200 bg-white ${day.is_free ? 'opacity-80' : ''}`}>
      {/* Encabezado de la columna */}
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
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 min-w-0">
            <CityPicker value={day.city || ''} onChange={onCityChange} placeholder="Ciudad…" />
          </div>
          <button onClick={onToggleFree}
            className={`text-[10px] px-2 py-1 rounded-full border flex-shrink-0 ${day.is_free ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-stone-400 border-stone-200 hover:border-stone-300'}`}>
            Libre
          </button>
        </div>
      </div>

      {/* Servicios */}
      <div className="flex-1 px-3 py-3 min-h-[80px]">
        {cover && (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-2 mb-2 flex items-center gap-2 text-xs text-emerald-700">
            <Hotel className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{cover.service.name || 'Hotel'}</span>
            <span className="text-[10px] text-emerald-600/70 ml-auto flex-shrink-0">noche {cover.night}/{cover.of}</span>
          </div>
        )}

        <Droppable droppableId={day.id} type="service">
          {(provided, snapshot) => (
            <div ref={provided.innerRef} {...provided.droppableProps}
              className={`space-y-2 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-amber-50/40 outline-dashed outline-1 outline-amber-200' : ''} min-h-[8px]`}>
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
          <p className="text-xs text-stone-300 py-2 text-center italic">Sin servicios</p>
        )}
      </div>

      {/* Agregar servicio */}
      <div className="px-3 pb-3 pt-1 border-t border-stone-100">
        <div className="flex flex-wrap gap-1">
          {TYPE_ORDER.map(t => {
            const ui = TYPE_UI[t];
            return (
              <button key={t} onClick={() => onAddService(t)} title={`Agregar ${ui.label}`}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-dashed border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-400 hover:border-solid transition-colors">
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
  return <button onClick={onClick} title={title} className="p-1 rounded hover:bg-stone-100 hover:text-stone-600">{children}</button>;
}
