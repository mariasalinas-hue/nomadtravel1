import { useState } from 'react';
import { Hotel, Plane, Compass, Car, Train, Package, Ship, Briefcase, GripVertical, ChevronDown, Trash2, Copy, ImageIcon, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabaseAPI } from '@/api/supabaseClient';
import { money, commissionOf } from '@/lib/quoteEngine';
import MetaFields from './metaFields';

// Ícono + acento por tipo (design system del CRM).
export const TYPE_UI = {
  hotel:    { label: 'Hospedaje', Icon: Hotel,   accent: '#3f6b58', chip: 'bg-emerald-50 text-emerald-600' },
  vuelo:    { label: 'Vuelo',     Icon: Plane,   accent: '#5d6b8a', chip: 'bg-sky-50 text-sky-600' },
  crucero:  { label: 'Crucero',   Icon: Ship,    accent: '#4a7a8c', chip: 'bg-cyan-50 text-cyan-600' },
  tour:     { label: 'Tour',      Icon: Compass, accent: '#b8955a', chip: 'bg-amber-50 text-amber-600' },
  traslado: { label: 'Traslado',  Icon: Car,     accent: '#8a6b5d', chip: 'bg-orange-50 text-orange-600' },
  tren:     { label: 'Tren',      Icon: Train,   accent: '#6f6f73', chip: 'bg-stone-100 text-stone-600' },
  dmc:      { label: 'DMC',       Icon: Briefcase, accent: '#7a6b8a', chip: 'bg-indigo-50 text-indigo-600' },
  otro:     { label: 'Otro',      Icon: Package, accent: '#8f8a7f', chip: 'bg-stone-100 text-stone-500' },
};

export default function ServiceCard({ service, pax, rules, onChange, onDelete, onDuplicate, dragHandleProps }) {
  const [open, setOpen] = useState(!service?.name);
  const ui = TYPE_UI[service?.type] || TYPE_UI.otro;
  const gross = Number(service.gross) || 0;
  const commission = commissionOf(service);
  const perPax = pax ? gross / pax : 0;
  const isHotel = service.type === 'hotel';

  const sub = isHotel
    ? `${service.nights || 1} noche${(service.nights || 1) > 1 ? 's' : ''}${service.rooms ? ` · ${service.rooms} hab` : ''}${service.breakfast ? ' · desayuno' : ''}`
    : (service.supplier || '');

  // Pista de cómo se calcula el bruto/comisión.
  const rule = (rules || {})[service.type];
  const ruleText = service.price_mode === 'net'
    ? (rule?.mode === 'per_pax' ? `neto + $${rule.value}/persona` : `neto ÷ ${rule?.value ?? 0.85}`)
    : 'comisionable 8.5%';

  const set = (patch) => onChange(patch);

  return (
    <div className="rounded-xl border border-stone-100 bg-white hover:border-stone-200 transition-colors overflow-hidden" style={{ borderLeft: `3px solid ${ui.accent}` }}>
      {/* Fila resumen */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span {...(dragHandleProps || {})} className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ui.chip}`}>
          <ui.Icon className="w-3.5 h-3.5" />
        </div>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800 truncate">
              {service.name || <span className="text-stone-400 italic">Sin nombre</span>}
              {sub && <span className="text-stone-400 font-normal text-xs ml-1.5">{sub}</span>}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-semibold tabular-nums ${gross ? 'text-stone-800' : 'text-orange-500'}`}>{gross ? money(gross) : 'pendiente'}</p>
            {gross > 0 && <p className="text-[10px] text-stone-400 tabular-nums">Com. {money(commission)}</p>}
          </div>
          <ChevronDown className={`w-4 h-4 text-stone-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Edición */}
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-stone-100 space-y-3">
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

          {/* Campos ricos por tipo (catálogos: aerolínea, cadena, crucero…) */}
          <MetaFields type={service.type} meta={service.meta} onSet={(k, v) => set({ meta: { ...(service.meta || {}), [k]: v } })} />

          {/* Foto para el cliente (se muestra en la cotización compartida) */}
          <PhotoField url={service.meta?.image_url} onSet={(url) => set({ meta: { ...(service.meta || {}), image_url: url } })} />

          {/* Comisión por item */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#2E442A0A' }}>
            <span className="text-[11px] text-stone-500">{ruleText} · {money(perPax)} por persona</span>
            <span className="text-sm font-bold" style={{ color: '#2E442A' }}>Tu comisión: {money(commission)}</span>
          </div>

          <div>
            <Label>Descripción para el cliente</Label>
            <Textarea defaultValue={service.description || ''} onBlur={(e) => set({ description: e.target.value })} rows={2} placeholder="Lo que verá el cliente…" />
          </div>

          <div className="flex justify-end gap-1">
            <IconBtn onClick={onDuplicate} title="Duplicar"><Copy className="w-3.5 h-3.5" /></IconBtn>
            <IconBtn onClick={onDelete} title="Eliminar" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }) { return <label className="text-[11px] text-stone-400 mb-0.5 block">{children}</label>; }

// Sube una foto del servicio a Storage y guarda la URL pública en meta.image_url.
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
    } catch (err) {
      toast.error(`No se pudo subir: ${err?.message || 'error'}`);
    } finally { setBusy(false); }
  };
  return (
    <div>
      <Label>Foto para el cliente</Label>
      {url ? (
        <div className="relative w-full">
          <img src={url} alt="" className="w-full h-28 object-cover rounded-lg border border-stone-200" />
          <button onClick={() => onSet(null)} title="Quitar foto"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 border border-stone-200 flex items-center justify-center text-stone-500 hover:text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed border-stone-200 text-xs text-stone-400 hover:border-stone-400 hover:text-stone-600 cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {busy ? 'Subiendo…' : 'Agregar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      )}
    </div>
  );
}
function IconBtn({ children, onClick, title, danger }) {
  return <button onClick={onClick} title={title} className={`p-1.5 rounded-lg ${danger ? 'text-stone-400 hover:text-red-500 hover:bg-red-50' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}>{children}</button>;
}
// Input de dinero: escribe libre, confirma número en blur.
function MoneyInput({ value, onCommit }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-stone-400 text-sm">$</span>
      <Input type="number" min={0} defaultValue={value ?? ''} onBlur={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))} className="text-right tabular-nums" />
    </div>
  );
}
