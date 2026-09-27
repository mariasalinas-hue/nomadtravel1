import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useServiceDropdownByCategory, useCreateServiceDropdownOption } from '@/hooks/useServiceDropdownOptions';
import { HOTEL_CHAINS, AIRLINE_OPTIONS, CRUISE_LINES, CRUISE_SHIP_OPTIONS, SELECTS } from '@/components/quote/serviceFields';

// Campos ricos por tipo (curados para cotizar). Complementan los campos base de
// la tarjeta (nombre, proveedor, precio, noches/hab/desayuno, descripción).
//   kind: 'catalog' usa un catálogo editable (aerolíneas, cadenas…) + búsqueda.
export const QUOTE_META_FIELDS = {
  hotel: [
    { key: 'hotel_chain', label: 'Cadena', kind: 'catalog', category: 'hotel_chain', base: HOTEL_CHAINS },
    { key: 'room_type', label: 'Tipo de habitación', kind: 'text' },
    { key: 'meal_plan', label: 'Plan de alimentos', kind: 'select', options: SELECTS.meal_plan },
    { key: 'reserved_by', label: 'Programa / Consorcio', kind: 'catalog', category: 'hotel_reserved_by', base: SELECTS.reserved_by },
  ],
  vuelo: [
    { key: 'airline', label: 'Aerolínea', kind: 'catalog', category: 'airline', base: AIRLINE_OPTIONS, valueIsLabel: true },
    { key: 'flight_class', label: 'Clase', kind: 'select', options: SELECTS.flight_class },
    { key: 'route', label: 'Ruta', kind: 'text', placeholder: 'MTY → YYZ' },
    { key: 'layover', label: 'Escala', kind: 'text', placeholder: '2h en Toronto' },
    { key: 'flight_number', label: '# Vuelo', kind: 'text' },
    { key: 'baggage', label: 'Maletas', kind: 'select', options: SELECTS.baggage },
  ],
  crucero: [
    { key: 'cruise_line', label: 'Línea (naviera)', kind: 'catalog', category: 'cruise_line', base: CRUISE_LINES },
    { key: 'cruise_ship', label: 'Barco', kind: 'catalog', category: 'cruise_ship', base: CRUISE_SHIP_OPTIONS, valueIsLabel: true },
    { key: 'cruise_nights', label: 'Noches', kind: 'number' },
    { key: 'cruise_cabin_type', label: 'Cabina', kind: 'select', options: SELECTS.cabin_type },
  ],
  tour: [
    { key: 'tour_city', label: 'Ciudad', kind: 'text' },
    { key: 'tour_duration', label: 'Duración', kind: 'text', placeholder: '4 horas' },
  ],
  traslado: [
    { key: 'transfer_type', label: 'Tipo', kind: 'select', options: SELECTS.transfer_type },
    { key: 'transfer_origin', label: 'Origen', kind: 'text' },
    { key: 'transfer_destination', label: 'Destino', kind: 'text' },
  ],
  tren: [
    { key: 'train_operator', label: 'Operador', kind: 'text' },
    { key: 'train_route', label: 'Ruta', kind: 'text' },
    { key: 'train_class', label: 'Clase', kind: 'text' },
  ],
  dmc: [
    { key: 'dmc_destination', label: 'Destino', kind: 'text' },
  ],
  otro: [],
};

export default function MetaFields({ type, meta, onSet }) {
  const fields = QUOTE_META_FIELDS[type] || [];
  if (!fields.length) return null;
  const val = (k) => meta?.[k] ?? '';
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(f => (
        <div key={f.key} className={f.kind === 'catalog' ? 'col-span-2 sm:col-span-1' : ''}>
          <label className="text-[11px] text-stone-400 mb-0.5 block">{f.label}</label>
          {f.kind === 'catalog' ? (
            <CatalogCombo category={f.category} base={f.base} value={val(f.key)} valueIsLabel={f.valueIsLabel} onChange={(v) => onSet(f.key, v)} />
          ) : f.kind === 'select' ? (
            <select value={val(f.key)} onChange={(e) => onSet(f.key, e.target.value)}
              className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-700 focus:outline-none focus:border-[#C9A84C]">
              <option value="">—</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <Input type={f.kind === 'number' ? 'number' : 'text'} defaultValue={val(f.key)} placeholder={f.placeholder || ''}
              onBlur={(e) => onSet(f.key, f.kind === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

// Combobox de catálogo: mezcla la lista base con lo que el admin agregó en el
// CRM (ServiceDropdownOption), con búsqueda y opción de agregar nuevo.
function CatalogCombo({ category, base = [], value, valueIsLabel, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: dbOptions = [] } = useServiceDropdownByCategory(category);
  const createOption = useCreateServiceDropdownOption();

  const options = useMemo(() => {
    const map = new Map();
    base.forEach(o => map.set(String(o.value), { value: valueIsLabel ? o.label : o.value, label: o.label }));
    dbOptions.forEach(o => map.set(String(o.value), { value: o.value, label: o.label || o.value }));
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [base, dbOptions, valueIsLabel]);

  const current = options.find(o => String(o.value) === String(value));
  const filtered = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  const pick = (v) => { onChange(v); setOpen(false); setQuery(''); };
  const addNew = async () => {
    const v = query.trim(); if (!v) return;
    try { await createOption.mutateAsync({ category, value: v, is_active: true }); } catch { /* se usa igual */ }
    pick(v);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2 text-sm flex items-center justify-between">
          {current || value ? <span className="truncate text-stone-800">{current?.label || value}</span> : <span className="text-stone-400">Elegir…</span>}
          <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[260px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar…" />
          <CommandList>
            {filtered.slice(0, 60).map(o => (
              <CommandItem key={o.value} value={o.value} onSelect={() => pick(o.value)}>
                <Check className={`w-3.5 h-3.5 mr-2 ${String(o.value) === String(value) ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                {o.label}
              </CommandItem>
            ))}
            {query && !filtered.some(o => o.label.toLowerCase() === query.toLowerCase()) && (
              <CommandItem value={`__add__${query}`} onSelect={addNew} className="text-emerald-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> Agregar "{query}"
              </CommandItem>
            )}
            {!filtered.length && !query && <CommandEmpty>Sin opciones</CommandEmpty>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
