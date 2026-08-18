import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pricingView, applyBase, applyCommission, applyType } from '@/lib/quotePricing';

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

// Bloque de captura de precio: [Precio] [Bruto/Neto] [Comisión] + Total final.
// La lógica vive en @/lib/quotePricing (misma que usa la casilla de la tabla).
export default function PricingBlock({ service, onApply }) {
  const view = pricingView(service);
  const [baseStr, setBaseStr] = useState('');
  const [commStr, setCommStr] = useState('');
  // Resincroniza cuando cambian los valores subyacentes (toggle de tipo, 8% auto…)
  useEffect(() => { setBaseStr(view.base ? String(view.base) : ''); }, [view.base]);
  useEffect(() => { setCommStr(view.commission ? String(view.commission) : ''); }, [view.commission]);

  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50/40 p-3 space-y-2.5">
      <div className="grid grid-cols-[1fr_5rem_1fr] gap-2 items-end">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Precio {view.pt === 'neto' ? '(neto)' : '(bruto)'}
          </label>
          <Input type="number" step="0.01" min="0" inputMode="decimal" value={baseStr} placeholder="0"
            onChange={(e) => setBaseStr(e.target.value)} onBlur={() => onApply(applyBase(service, baseStr))}
            className="h-9 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Tipo</label>
          <Select value={view.pt} onValueChange={(v) => onApply(applyType(service, v))}>
            <SelectTrigger className="h-9 rounded-lg text-sm px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bruto">Bruto</SelectItem>
              <SelectItem value="neto">Neto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Comisión{view.auto ? ' · 8%' : ''}
          </label>
          <Input type="number" step="0.01" min="0" inputMode="decimal" value={commStr} placeholder="0"
            onChange={(e) => setCommStr(e.target.value)} onBlur={() => onApply(applyCommission(service, commStr))}
            className="h-9 rounded-lg text-sm" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-stone-200 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Total final</span>
        <span className="text-base font-bold text-stone-800 tabular-nums">{money(view.total)}</span>
      </div>
      <p className="text-[10px] text-stone-400 leading-tight">
        {view.pt === 'neto' ? 'Total = neto + comisión.' : 'Comisión 8% por default (editable).'}
      </p>
    </div>
  );
}
