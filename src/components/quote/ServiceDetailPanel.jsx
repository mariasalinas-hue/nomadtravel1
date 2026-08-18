import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown, Trash2, Check } from 'lucide-react';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { useServiceDropdownOptions } from '@/hooks/useServiceDropdownOptions';
import { TYPE_FIELDS, COMMON_OPERAR, AMENITIES } from './serviceFields';
import PricingBlock from './PricingBlock';

const TYPE_LABEL = { hotel: 'Hotel', vuelo: 'Vuelo', traslado: 'Traslado', tour: 'Tour', tren: 'Tren', crucero: 'Crucero', dmc: 'DMC', otro: 'Otro' };
const inputTypeFor = (k) => (k === 'number' ? 'number' : k === 'date' ? 'date' : k === 'time' ? 'time' : k === 'datetime' ? 'datetime-local' : 'text');
const diffNights = (a, b) => { const da = parseLocalDate(a), db = parseLocalDate(b); if (!da || !db) return ''; const n = Math.round((db - da) / 86400000); return n > 0 ? n : ''; };
const dayDiff = (a, b) => { const da = parseLocalDate(a), db = parseLocalDate(b); if (!da || !db) return 0; return Math.round((db - da) / 86400000); };

export default function ServiceDetailPanel({ service, onSet, onSetMeta, onApplyPricing, onDelete, onClose }) {
  const [showOp, setShowOp] = useState(false);
  const { data: adminOptions = [] } = useServiceDropdownOptions();
  const type = service?.service_type || 'otro';
  const cfg = TYPE_FIELDS[type] || TYPE_FIELDS.otro;
  const startDate = service?.start_date || '';
  const metaVal = (k) => service?.metadata?.[k] ?? '';
  const valOf = (f) => (f.meta ? service?.metadata?.[f.key] : service?.[f.key]) ?? '';

  const catalogOptions = (f) => {
    // valueIsLabel: el valor guardado es el NOMBRE visible (p. ej. barcos, que en
    // Corsario son texto libre), no un value interno tipo snake_case.
    const admin = adminOptions.filter((o) => o.category === f.catalog && o.is_active)
      .map((o) => { const lbl = o.label || o.value; return f.valueIsLabel ? { value: lbl, label: lbl } : { value: o.value, label: lbl }; });
    const seen = new Set();
    const out = [];
    [...(f.baseOptions || []), ...admin].forEach((o) => { if (!seen.has(o.value)) { seen.add(o.value); out.push(o); } });
    const cur = valOf(f);
    if (cur && !seen.has(cur)) out.unshift({ value: cur, label: cur });
    return out;
  };

  const toggleAmenity = (a) => {
    const cur = Array.isArray(metaVal('amenities')) ? metaVal('amenities') : [];
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
    onSet('amenities', next, true, true);
  };

  const Field = (f) => {
    if (f.kind === 'readonly_date') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <div className="h-9 flex items-center px-3 rounded-lg bg-stone-100 text-sm text-stone-600">
            {startDate ? formatDate(parseLocalDate(startDate), 'EEE d MMM yyyy', { locale: es }) : '—'}
          </div>
        </div>
      );
    }
    if (f.kind === 'nights') {
      const n = metaVal('nights') || diffNights(startDate, metaVal('check_out'));
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <div className="h-9 flex items-center px-3 rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700">{n ? `${n} noche${n !== 1 ? 's' : ''}` : '—'}</div>
        </div>
      );
    }
    if (f.kind === 'checkout') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <Input type="date" min={startDate || undefined} value={metaVal('check_out')} className="h-9 rounded-lg text-sm"
            onChange={(e) => { const co = e.target.value; onSetMeta({ check_out: co, check_in: startDate, nights: diffNights(startDate, co) }, true); }} />
        </div>
      );
    }
    if (f.kind === 'arrival') {
      const arr = metaVal('arrival_date') || startDate;
      const offset = dayDiff(startDate, arr);
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <Input type="date" min={startDate || undefined} value={arr} className="h-9 rounded-lg text-sm"
            onChange={(e) => onSetMeta({ arrival_date: e.target.value }, true)} />
          {offset > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
              +{offset} día{offset !== 1 ? 's' : ''} · llega {formatDate(parseLocalDate(arr), 'EEE d MMM', { locale: es })}
            </span>
          )}
        </div>
      );
    }
    if (f.kind === 'amenities') {
      const cur = Array.isArray(metaVal('amenities')) ? metaVal('amenities') : [];
      return (
        <div key={f.key} className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <div className="flex flex-wrap gap-1.5">
            {AMENITIES.map((a) => {
              const on = cur.includes(a);
              return (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                  {on && <Check className="w-3 h-3" />}{a}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (f.kind === 'catalog') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
          <Select value={valOf(f) || undefined} onValueChange={(v) => onSet(f.key, v, f.meta, true)}>
            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{catalogOptions(f).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div key={f.key} className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{f.label}</label>
        {f.kind === 'select' ? (
          <Select value={valOf(f) || undefined} onValueChange={(v) => onSet(f.key, v, f.meta, true)}>
            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : f.kind === 'textarea' ? (
          <Textarea value={valOf(f)} rows={2} className="rounded-lg text-sm"
            onChange={(e) => onSet(f.key, e.target.value, f.meta, false)} onBlur={(e) => onSet(f.key, e.target.value, f.meta, true)} />
        ) : (
          <Input type={inputTypeFor(f.kind)} value={valOf(f)} className="h-9 rounded-lg text-sm"
            onChange={(e) => onSet(f.key, e.target.value, f.meta, false)} onBlur={(e) => onSet(f.key, e.target.value, f.meta, true)} />
        )}
      </div>
    );
  };

  return (
    <Sheet open={!!service} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {service && (
          <div className="space-y-5 pb-8">
            <SheetHeader className="space-y-1 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{TYPE_LABEL[type]}</span>
              <SheetTitle className="text-lg">Detalle del servicio</SheetTitle>
            </SheetHeader>

            <div className="space-y-3">
              {Field({ key: 'service_name', label: 'Nombre', kind: 'text', meta: false })}
              <PricingBlock service={service} onApply={onApplyPricing} />
              {cfg.esencial.map(Field)}
              {Field({ key: 'client_description', label: 'Descripción para el cliente', kind: 'textarea', meta: true })}
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button onClick={() => setShowOp((o) => !o)} className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                <ChevronDown className={`w-4 h-4 transition-transform ${showOp ? 'rotate-180' : ''}`} /> Para operar (opcional)
              </button>
              {showOp && <div className="space-y-3 mt-3">{cfg.operar.map(Field)}{COMMON_OPERAR.map(Field)}</div>}
            </div>

            <div className="border-t border-stone-100 pt-4">
              <Button variant="outline" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4 mr-1.5" /> Eliminar servicio
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
