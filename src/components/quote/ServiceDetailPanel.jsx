import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown, Trash2 } from 'lucide-react';
import { TYPE_FIELDS, COMMON_OPERAR } from './serviceFields';

const TYPE_LABEL = {
  hotel: 'Hotel', vuelo: 'Vuelo', traslado: 'Traslado', tour: 'Tour',
  tren: 'Tren', crucero: 'Crucero', dmc: 'DMC', otro: 'Otro',
};

const inputTypeFor = (kind) =>
  kind === 'number' ? 'number' : kind === 'date' ? 'date' : kind === 'time' ? 'time' : kind === 'datetime' ? 'datetime-local' : 'text';

// Panel lateral de detalle de un servicio de la cotización.
// onSet(field, value, meta, persist): actualiza el estado y (si persist) guarda.
export default function ServiceDetailPanel({ service, onSet, onDelete, onClose }) {
  const [showOp, setShowOp] = useState(false);
  const type = service?.service_type || 'otro';
  const cfg = TYPE_FIELDS[type] || TYPE_FIELDS.otro;
  const valOf = (f) => {
    const v = f.meta ? service?.metadata?.[f.key] : service?.[f.key];
    return v ?? '';
  };

  const Field = (f) => (
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

  return (
    <Sheet open={!!service} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {service && (
          <div className="space-y-5 pb-8">
            <SheetHeader className="space-y-1 text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{TYPE_LABEL[type]}</span>
              <SheetTitle className="text-lg">Detalle del servicio</SheetTitle>
            </SheetHeader>

            {/* Esencial */}
            <div className="space-y-3">
              {Field({ key: 'service_name', label: 'Nombre', kind: 'text', meta: false })}
              <div className="grid grid-cols-2 gap-3">
                {Field({ key: 'price', label: 'Precio (USD)', kind: 'number', meta: false })}
                {Field({ key: 'commission', label: 'Comisión (USD)', kind: 'number', meta: false })}
              </div>
              {cfg.esencial.map(Field)}
              {Field({ key: 'client_description', label: 'Descripción para el cliente', kind: 'textarea', meta: true })}
            </div>

            {/* Para operar (opcional) */}
            <div className="border-t border-stone-100 pt-3">
              <button onClick={() => setShowOp((o) => !o)} className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                <ChevronDown className={`w-4 h-4 transition-transform ${showOp ? 'rotate-180' : ''}`} />
                Para operar (opcional)
              </button>
              {showOp && (
                <div className="space-y-3 mt-3">
                  {cfg.operar.map(Field)}
                  {COMMON_OPERAR.map(Field)}
                </div>
              )}
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
