import { useState, useMemo } from 'react';
import { MapPin, Plus, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { useServiceDropdownByCategory, useCreateServiceDropdownOption } from '@/hooks/useServiceDropdownOptions';
import { mergeCities, searchCities, norm } from '@/lib/cityCatalog';

// Selector de ciudad con lista curada (crece sola) y búsqueda tolerante a
// acentos/typos/alias. La ciudad elegida se guarda como texto ("Ciudad, País").
export default function CityPicker({ value, onChange, placeholder = 'Ciudad…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: dbOptions = [] } = useServiceDropdownByCategory('city');
  const createOption = useCreateServiceDropdownOption();

  const cities = useMemo(() => mergeCities(dbOptions.map((o) => o.value)), [dbOptions]);
  const results = useMemo(() => searchCities(query, cities), [query, cities]);
  const exact = query.trim() && cities.some((c) => norm(c) === norm(query));

  const pick = (city) => { onChange(city); setOpen(false); setQuery(''); };
  const addNew = async () => {
    const v = query.trim();
    if (!v) return;
    try { await createOption.mutateAsync({ category: 'city', value: v, is_active: true }); } catch { /* se usa igual */ }
    pick(v);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-1.5 text-left text-sm px-1.5 py-1 rounded hover:bg-stone-100/70 focus:bg-blue-50/70 focus:ring-1 focus:ring-blue-300 outline-none"
          title="Elegir ciudad"
        >
          <MapPin className="w-3.5 h-3.5 text-stone-300 flex-shrink-0" />
          {value ? <span className="truncate text-stone-800">{value}</span> : <span className="text-stone-400">{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar ciudad o país…" />
          <CommandList>
            {results.length === 0 && !query.trim() && <CommandEmpty>Escribe para buscar…</CommandEmpty>}
            {results.map((c) => (
              <CommandItem key={c} value={c} onSelect={() => pick(c)}>
                <Check className={`w-3.5 h-3.5 mr-2 ${norm(c) === norm(value) ? 'opacity-100 text-emerald-600' : 'opacity-0'}`} />
                {c}
              </CommandItem>
            ))}
            {query.trim() && !exact && (
              <CommandItem value={`__add__${query}`} onSelect={addNew} className="text-emerald-700">
                <Plus className="w-3.5 h-3.5 mr-2" /> Agregar “{query.trim()}”
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
