import { useState, useMemo } from 'react';
import { Globe } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { COUNTRIES } from '@/lib/countries';
import { norm } from '@/lib/cityCatalog';

// Selector de país con búsqueda tolerante a acentos. Guarda el nombre ("México").
export default function CountryPicker({ value, onChange, placeholder = 'País…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return COUNTRIES.slice(0, 60);
    return COUNTRIES.filter(c => norm(c.name).includes(q)).slice(0, 60);
  }, [query]);

  const pick = (name) => { onChange(name); setOpen(false); setQuery(''); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full flex items-center gap-1.5 text-left text-sm px-1.5 py-1 rounded hover:bg-stone-100/70 focus:bg-blue-50/70 focus:ring-1 focus:ring-blue-300 outline-none" title="Elegir país">
          <Globe className="w-3.5 h-3.5 text-stone-300 flex-shrink-0" />
          {value ? <span className="truncate text-stone-800">{value}</span> : <span className="text-stone-400">{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar país…" />
          <CommandList>
            {results.length === 0 && <CommandEmpty>Sin resultados</CommandEmpty>}
            {results.map(c => (
              <CommandItem key={c.code} value={c.name} onSelect={() => pick(c.name)}>{c.name}</CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
