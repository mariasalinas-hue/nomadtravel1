import { useRef, useEffect, useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { Save, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import UniverSheet from './UniverSheet';
import { buildQuoteSheetTemplate } from './quoteSheetTemplate';

// Vista "Hoja" del cotizador: hoja de cálculo tipo Excel por cotización, guardada
// en quotes.sheet_data. Si la cotización aún no tiene hoja, arranca con la plantilla.
export default function QuoteSheet({ quote }) {
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  // Datos iniciales fijos para el mount (no recrear en cada render).
  const initialRef = useRef(quote.sheet_data || buildQuoteSheetTemplate(quote));

  const persist = async (silent) => {
    const snap = sheetRef.current?.snapshot();
    if (!snap) return;
    if (!silent) setSaving(true);
    try {
      await supabaseAPI.entities.Quote.update(quote.id, { sheet_data: snap });
      setSavedAt(Date.now());
      if (!silent) toast.success('Hoja guardada');
    } catch (e) {
      if (!silent) toast.error(`No se pudo guardar: ${e?.message || 'corre la migración quote_sheet_data'}`);
    } finally {
      if (!silent) setSaving(false);
    }
  };

  // Autoguardado al cerrar/desmontar.
  useEffect(() => () => { persist(true); }, []);

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-2">
        {savedAt && <span className="text-xs text-stone-400 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Guardada</span>}
        <button onClick={() => persist(false)} disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style={{ backgroundColor: '#2E442A' }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar hoja
        </button>
      </div>
      <div className="h-[70vh] border border-stone-200 rounded-xl overflow-hidden">
        <UniverSheet ref={sheetRef} data={initialRef.current} />
      </div>
    </div>
  );
}
