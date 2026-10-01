import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabaseAPI } from '@/api/supabaseClient';
import { Trash2, Copy, Plus, ImageIcon, Loader2, X, Check, Star } from 'lucide-react';
import { money, commissionOf } from '@/lib/quoteEngine';
import { TYPE_UI } from './ServiceCard';
import MetaFields from './metaFields';

// Ventana (scrolleable) para llenar un servicio. Incluye opciones (Opción 1/2).
export default function ServiceEditorModal({
  open, onOpenChange, service, pax, rules,
  siblings = [], onChange, onDelete, onDuplicate, onAddOption, onSelectOption, onEditSibling,
}) {
  if (!service) return null;
  const ui = TYPE_UI[service.type] || TYPE_UI.otro;
  const gross = Number(service.gross) || 0;
  const commission = commissionOf(service);
  const perPax = pax ? gross / pax : 0;
  const isHotel = service.type === 'hotel';
  const set = (patch) => onChange(patch);

  const rule = (rules || {})[service.type];
  const ruleText = service.price_mode === 'net'
    ? (rule?.mode === 'per_pax' ? `neto + $${rule.value}/persona` : `neto ÷ ${rule?.value ?? 0.85}`)
    : 'comisionable 8.5%';

  const hasOptions = siblings.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ui.chip}`}>
            <ui.Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-stone-400">{ui.label}{service.option_label ? ` · ${service.option_label}` : ''}</p>
            <p className="text-sm font-semibold text-stone-800 truncate">{service.name || 'Nuevo servicio'}</p>
          </div>
        </div>

        {/* Barra de opciones */}
        {hasOptions && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-stone-100 bg-stone-50/70 overflow-x-auto">
            {siblings.map((o) => (
              <button key={o.id} onClick={() => onEditSibling?.(o.id)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${o.id === service.id ? 'border-stone-800 text-stone-800 font-medium' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                {o.is_selected && <Star className="w-3 h-3 text-[#C9A84C] fill-[#C9A84C]" />}
                {o.option_label || 'Opción'}
              </button>
            ))}
            <button onClick={onAddOption} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-stone-300 text-stone-500 hover:text-stone-800 flex-shrink-0">
              <Plus className="w-3 h-3" /> Opción
            </button>
          </div>
        )}

        {/* Cuerpo scrolleable */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {hasOptions && (
            <button onClick={() => onSelectOption?.(service.id)} disabled={service.is_selected}
              className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border ${service.is_selected ? 'border-[#C9A84C] text-[#8a6b1a] bg-amber-50' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
              {service.is_selected ? <><Check className="w-3.5 h-3.5" /> Esta es la opción elegida (cuenta al total)</> : 'Marcar esta opción como la elegida'}
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre</Label>
              <Input defaultValue={service.name || ''} onBlur={(e) => set({ name: e.target.value })} placeholder="Hotel, tour, vuelo…" autoFocus={!service.name} />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input defaultValue={service.supplier || ''} onBlur={(e) => set({ supplier: e.target.value })} placeholder="DMC, directo…" />
            </div>
            <div>
              <Label>Precio</Label>
              <div className="flex rounded-lg border border-stone-200 overflow-hidden w-max">
                {['gross', 'net'].map(m => (
                  <button key={m} onClick={() => set({ price_mode: m })}
                    className={`px-3 py-1.5 text-xs font-medium ${service.price_mode === m ? 'text-white' : 'text-stone-500'}`}
                    style={service.price_mode === m ? { backgroundColor: '#2E442A' } : {}}>
                    {m === 'gross' ? 'Bruto' : 'Neto'}
                  </button>
                ))}
              </div>
            </div>

            {isHotel && (
              <>
                <div><Label>Noches</Label><Input type="number" min={1} defaultValue={service.nights || 1} onBlur={(e) => set({ nights: Number(e.target.value) || 1 })} /></div>
                <div><Label>Habitaciones</Label><Input type="number" min={1} defaultValue={service.rooms || ''} onBlur={(e) => set({ rooms: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input type="checkbox" defaultChecked={!!service.breakfast} onChange={(e) => set({ breakfast: e.target.checked })} /> Desayuno incluido
                </label>
              </>
            )}

            {service.price_mode === 'net' && (
              <div>
                <Label>Neto (grupo)</Label>
                <MoneyInput value={service.net} onCommit={(v) => set({ net: v })} />
              </div>
            )}
            <div>
              <Label>Bruto (grupo)</Label>
              <MoneyInput value={service.gross} onCommit={(v) => set({ gross: v })} />
            </div>
          </div>

          {/* Campos ricos por tipo */}
          <MetaFields type={service.type} meta={service.meta} onSet={(k, v) => set({ meta: { ...(service.meta || {}), [k]: v } })} />

          {/* Foto para el cliente */}
          <PhotoField url={service.meta?.image_url} onSet={(url) => set({ meta: { ...(service.meta || {}), image_url: url } })} />

          {/* Comisión */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#2E442A0A' }}>
            <span className="text-[11px] text-stone-500">{ruleText} · {money(perPax)} por persona</span>
            <span className="text-sm font-bold" style={{ color: '#2E442A' }}>Tu comisión: {money(commission)}</span>
          </div>

          <div>
            <Label>Descripción para el cliente</Label>
            <Textarea defaultValue={service.description || ''} onBlur={(e) => set({ description: e.target.value })} rows={3} placeholder="Lo que verá el cliente…" />
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-stone-100">
          {!hasOptions && (
            <button onClick={onAddOption} className="flex items-center gap-1.5 text-xs text-stone-600 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300">
              <Plus className="w-3.5 h-3.5" /> Agregar opción
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <IconBtn onClick={onDuplicate} title="Duplicar"><Copy className="w-4 h-4" /></IconBtn>
            <IconBtn onClick={onDelete} title="Eliminar" danger><Trash2 className="w-4 h-4" /></IconBtn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }) { return <label className="text-[11px] text-stone-400 mb-0.5 block">{children}</label>; }
function IconBtn({ children, onClick, title, danger }) {
  return <button onClick={onClick} title={title} className={`p-2 rounded-lg ${danger ? 'text-stone-400 hover:text-red-500 hover:bg-red-50' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}>{children}</button>;
}
function MoneyInput({ value, onCommit }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-stone-400 text-sm">$</span>
      <Input type="number" min={0} defaultValue={value ?? ''} onBlur={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))} className="text-right tabular-nums" />
    </div>
  );
}
function PhotoField({ url, onSet }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige una imagen'); return; }
    setBusy(true);
    try {
      const { file_url } = await supabaseAPI.storage.uploadFile(file, 'documents', 'quotes');
      onSet(file_url);
    } catch (err) { toast.error(`No se pudo subir: ${err?.message || 'error'}`); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label>Foto para el cliente</Label>
      {url ? (
        <div className="relative w-full">
          <img src={url} alt="" className="w-full h-40 object-cover rounded-lg border border-stone-200" />
          <button onClick={() => onSet(null)} title="Quitar foto"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-stone-200 flex items-center justify-center text-stone-500 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 h-12 rounded-lg border border-dashed border-stone-200 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600 cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {busy ? 'Subiendo…' : 'Agregar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      )}
    </div>
  );
}
