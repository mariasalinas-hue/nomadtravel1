import { useMemo, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { useServiceDropdownByCategory, useCreateServiceDropdownOption } from '@/hooks/useServiceDropdownOptions';

// Qué categoría del catálogo de proveedores aplica por tipo de servicio.
const SUPPLIER_CATEGORY = {
  vuelo: 'flight_consolidator_nomad',
  crucero: 'cruise_provider',
  tren: 'train_provider',
};
export const supplierCategoryFor = (type) => SUPPLIER_CATEGORY[type] || null;

// Combo de proveedor conectado al catálogo (ServiceDropdownOption). Guarda el
// nombre legible (label) en service.supplier y permite agregar uno nuevo al vuelo.
export default function SupplierCombo({ type, value, onChange }) {
  const category = SUPPLIER_CATEGORY[type];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: dbOptions = [] } = useServiceDropdownByCategory(category || '__none__');
  const createOption = useCreateServiceDropdownOption();

  const options = useMemo(
    () => dbOptions.map(o => o.label || o.value).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [dbOptions],
  );
  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options;

  const pick = (label) => { onChange(label); setOpen(false); setQuery(''); };
  const addNew = async () => {
    const v = query.trim();
    if (!v || !category) return;
    try { await createOption.mutateAsync({ category, value: v, label: v, is_active: true }); } catch { /* se usa igual */ }
    pick(v);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full h-10 rounded-md border border-stone-200 bg-white px-3 text-sm flex items-center justify-between">
          {value ? <span className="truncate text-stone-800">{value}</span> : <span className="text-stone-400">Elegir proveedor…</span>}
          <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[260px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar proveedor…" />
          <CommandList>
            {filtered.slice(0, 60).map(o => (
              <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                <Check className={`w-3.5 h-3.5 mr-2 ${o === value ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                {o}
              </CommandItem>
            ))}
            {query && !filtered.some(o => o.toLowerCase() === query.toLowerCase()) && (
              <CommandItem value={`__add__${query}`} onSelect={addNew} className="text-emerald-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> Agregar "{query}"
              </CommandItem>
            )}
            {!filtered.length && !query && <CommandEmpty>Sin proveedores en el catálogo</CommandEmpty>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
