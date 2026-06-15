import { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from '@/lib/countries';

/**
 * Selector de países (multi-selección) con buscador.
 * El valor se guarda como string separado por ", " (formato usado en reportes
 * y en `destination`), p.ej. "Japón, Francia".
 */
export default function CountryMultiSelect({ value = '', onChange, placeholder = 'Buscar país...' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = value ? value.split(', ').filter(Boolean) : [];

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = COUNTRIES.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.region || '').toLowerCase().includes(q)
      || (c.subregion || '').toLowerCase().includes(q);
  });

  const toggle = (name) => {
    const next = selected.includes(name)
      ? selected.filter(n => n !== name)
      : [...selected, name];
    onChange(next.join(', '));
  };

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((name) => (
            <Badge key={name} variant="secondary" className="text-xs gap-1">
              {name}
              <button type="button" onClick={() => toggle(name)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-300"
        />
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 cursor-pointer"
          onClick={() => setOpen(o => !o)}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-lg">
          {filtered.length > 0 ? filtered.map((c) => {
            const isSel = selected.includes(c.name);
            return (
              <button
                type="button"
                key={c.code}
                onClick={() => toggle(c.name)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-stone-50 ${isSel ? 'bg-stone-50' : ''}`}
              >
                <span className="text-stone-700">{c.name}</span>
                <span className="text-[10px] text-stone-400">{isSel ? '✓' : c.region}</span>
              </button>
            );
          }) : (
            <p className="px-3 py-3 text-xs text-stone-400 text-center">Sin coincidencias</p>
          )}
        </div>
      )}
    </div>
  );
}
