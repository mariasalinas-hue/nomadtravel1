import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { Textarea } from '@/components/ui/textarea';
import { ImageIcon, Loader2, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// Portada de la cotización que ve el cliente: imagen + nota de bienvenida.
export default function QuoteCoverEditor({ quote, onSet }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige una imagen'); return; }
    setBusy(true);
    try {
      const { file_url } = await supabaseAPI.storage.uploadFile(file, 'documents', 'quotes');
      onSet({ cover_image_url: file_url });
    } catch (err) {
      toast.error(`No se pudo subir: ${err?.message || 'error'}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <ImageIcon className="w-4 h-4 text-stone-400" />
        <span className="text-sm font-medium text-stone-700">Portada para el cliente</span>
        {(quote.cover_image_url || quote.cover_note) && !open && (
          <span className="text-[11px] text-emerald-600">· lista</span>
        )}
        <ChevronDown className={`w-4 h-4 text-stone-300 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-[11px] text-stone-400 mb-1 block">Imagen de portada</label>
            {quote.cover_image_url ? (
              <div className="relative">
                <img src={quote.cover_image_url} alt="" className="w-full h-40 object-cover rounded-xl border border-stone-200" />
                <button onClick={() => onSet({ cover_image_url: null })} title="Quitar"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-stone-200 flex items-center justify-center text-stone-500 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl border border-dashed border-stone-200 text-sm text-stone-400 hover:border-stone-400 hover:text-stone-600 cursor-pointer">
                {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                {busy ? 'Subiendo…' : 'Subir imagen'}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
              </label>
            )}
          </div>
          <div>
            <label className="text-[11px] text-stone-400 mb-1 block">Nota de bienvenida</label>
            <Textarea
              defaultValue={quote.cover_note || ''}
              onBlur={(e) => onSet({ cover_note: e.target.value })}
              rows={6}
              placeholder="Un mensaje para el cliente al inicio de la cotización…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
