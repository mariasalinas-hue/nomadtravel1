import { useState } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { money } from '@/lib/quoteEngine';
import { Plus, MoreVertical, Copy, Trash2, Moon, ArrowUp, ArrowDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import CityPicker from '@/components/quote/CityPicker';
import CountryPicker from '@/components/quote/CountryPicker';
import { TYPE_UI } from './ServiceCard';

// Columnas de servicio (Traslado 1 y 2 son dos slots del mismo tipo 'traslado').
const SVC_COLS = [
  { key: 'hotel', label: 'Hotel', type: 'hotel' },
  { key: 'vuelo', label: 'Vuelo', type: 'vuelo' },
  { key: 'tr1', label: 'Traslado 1', type: 'traslado', slot: 0 },
  { key: 'tr2', label: 'Traslado 2', type: 'traslado', slot: 1 },
  { key: 'tour', label: 'Tour', type: 'tour' },
  { key: 'tren', label: 'Tren', type: 'tren' },
  { key: 'crucero', label: 'Crucero', type: 'crucero' },
  { key: 'otro', label: 'Otros', type: 'otro' },
];

function cellServices(day, col) {
  const list = (day.services || []).filter(s => s && s.id && s.type === col.type)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (col.slot === 0) return list.slice(0, 1);
  if (col.slot === 1) return list.slice(1);
  return list;
}

export default function QuoteTable({
  quote, days, onTripField,
  onOpenService, onAddService, onCity, onCountry, onActivity,
  onToggleFree, onDuplicateDay, onDeleteDay, onMoveDay, addDayAtEnd,
}) {
  return (
    <div>
      {/* Rango del viaje: genera las filas por día automáticamente */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <Field label="Salida" className="w-40">
          <input type="date" defaultValue={quote.start_date || ''} onChange={(e) => onTripField('start_date', e.target.value)}
            className="w-full h-9 rounded-lg border border-stone-200 px-2 text-sm" />
        </Field>
        <Field label="Regreso" className="w-40">
          <input type="date" defaultValue={quote.end_date || ''} onChange={(e) => onTripField('end_date', e.target.value)}
            className="w-full h-9 rounded-lg border border-stone-200 px-2 text-sm" />
        </Field>
        <Field label="Pax" className="w-20">
          <input type="number" min={1} defaultValue={quote.pax || 1} onBlur={(e) => onTripField('pax', Number(e.target.value) || 1)}
            className="w-full h-9 rounded-lg border border-stone-200 px-2 text-sm" />
        </Field>
        <p className="text-xs text-stone-400 pb-2">Las fechas por día se generan solas del rango.</p>
      </div>

      <div className="overflow-x-auto border border-stone-200 rounded-2xl">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-stone-50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
              <Th className="w-10 text-center">Día</Th>
              <Th className="min-w-[150px]">Fecha completa</Th>
              <Th className="min-w-[130px]">Ciudad</Th>
              <Th className="min-w-[120px]">País</Th>
              <Th className="min-w-[150px]">Actividad</Th>
              {SVC_COLS.map(c => <Th key={c.key} className="min-w-[130px]">{c.label}</Th>)}
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.id} className={`border-t border-stone-100 align-top ${d.is_free ? 'bg-amber-50/40' : ''}`}>
                <Td className="text-center font-semibold" style={{ color: '#C9A84C' }}>{i + 1}</Td>
                <Td>
                  <span className="text-stone-700 capitalize">{d.date ? formatDate(d.date, "EEEE d MMMM yyyy", { locale: es }) : '—'}</span>
                  {d.is_free && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">libre</span>}
                </Td>
                <Td><CityPicker value={d.city || ''} onChange={(v) => onCity(d.id, v)} placeholder="Ciudad…" /></Td>
                <Td><CountryPicker value={d.country || ''} onChange={(v) => onCountry(d.id, v)} /></Td>
                <Td>
                  <input defaultValue={d.activity || ''} onBlur={(e) => onActivity(d.id, e.target.value)} placeholder="Actividad del día…"
                    className="w-full bg-transparent text-sm text-stone-700 placeholder:text-stone-300 outline-none" />
                </Td>
                {SVC_COLS.map(col => (
                  <Td key={col.key}>
                    <ServiceCell services={cellServices(d, col)} onOpen={onOpenService} onAdd={() => onAddService(d.id, col.type)} />
                  </Td>
                ))}
                <Td>
                  <RowMenu onDuplicate={() => onDuplicateDay(i)} onDelete={() => onDeleteDay(i)} onToggleFree={() => onToggleFree(d.id)}
                    onUp={() => onMoveDay(i, -1)} onDown={() => onMoveDay(i, 1)} isFree={d.is_free} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addDayAtEnd}
        className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-stone-400 hover:text-stone-600 flex items-center justify-center gap-1.5 text-sm transition-colors">
        <Plus className="w-4 h-4" /> Agregar día
      </button>
    </div>
  );
}

function ServiceCell({ services, onOpen, onAdd }) {
  return (
    <div className="space-y-1">
      {services.map(s => {
        const ui = TYPE_UI[s.type] || TYPE_UI.otro;
        return (
          <button key={s.id} onClick={() => onOpen(s)}
            className="w-full flex items-center gap-1 rounded-md border border-stone-100 bg-white px-1.5 py-1 text-left hover:shadow-sm transition-shadow"
            style={{ borderLeft: `3px solid ${ui.accent}` }}>
            <ui.Icon className="w-3 h-3 flex-shrink-0" style={{ color: ui.accent }} />
            <span className="flex-1 min-w-0 truncate text-[11px] text-stone-700">{s.name || ui.label}</span>
            <span className="text-[11px] tabular-nums text-stone-500">{Number(s.gross) ? money(s.gross) : '—'}</span>
          </button>
        );
      })}
      <button onClick={onAdd} className="w-full flex items-center justify-center gap-1 text-[11px] text-stone-300 hover:text-stone-600 border border-dashed border-stone-200 hover:border-stone-300 rounded-md py-0.5">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function RowMenu({ onDuplicate, onDelete, onToggleFree, onUp, onDown, isFree }) {
  const [open, setOpen] = useState(false);
  const close = (fn) => () => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1 rounded text-stone-300 hover:bg-stone-100 hover:text-stone-600"><MoreVertical className="w-4 h-4" /></button>
      </PopoverTrigger>
      <PopoverContent className="p-1 w-44" align="end">
        <MI onClick={close(onUp)} icon={ArrowUp}>Mover arriba</MI>
        <MI onClick={close(onDown)} icon={ArrowDown}>Mover abajo</MI>
        <MI onClick={close(onDuplicate)} icon={Copy}>Duplicar día</MI>
        <MI onClick={close(onToggleFree)} icon={Moon}>{isFree ? 'Quitar día libre' : 'Marcar día libre'}</MI>
        <div className="h-px bg-stone-100 my-1" />
        <MI onClick={close(onDelete)} icon={Trash2} danger>Eliminar día</MI>
      </PopoverContent>
    </Popover>
  );
}

function MI({ children, onClick, icon: Icon, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left ${danger ? 'text-red-500 hover:bg-red-50' : 'text-stone-700 hover:bg-stone-100'}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {children}
    </button>
  );
}

function Field({ label, children, className = '' }) {
  return <div className={`flex flex-col ${className}`}><label className="text-[11px] text-stone-400 mb-0.5">{label}</label>{children}</div>;
}
function Th({ children, className = '' }) { return <th className={`px-3 py-2 font-semibold ${className}`}>{children}</th>; }
function Td({ children, className = '', style }) { return <td className={`px-3 py-2 ${className}`} style={style}>{children}</td>; }
