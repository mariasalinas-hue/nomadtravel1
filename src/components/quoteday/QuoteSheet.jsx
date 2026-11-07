import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseAPI } from '@/api/supabaseClient';
import { Save, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import UniverSheet from './UniverSheet';
import { buildQuoteSheetTemplate } from './quoteSheetTemplate';

// Vista "Hoja" del cotizador: hoja de cálculo tipo Excel por cotización, guardada
// en quotes.sheet_data. Si aún no tiene hoja, la siembra con los días reales del
// viaje usando la misma estructura de columnas que la Tabla.
export default function QuoteSheet({ quote }) {
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const hasSheet = !!quote.sheet_data;

  // Solo necesitamos los días para sembrar la plantilla cuando aún no hay hoja.
  const { data: rawDays, isLoading } = useQuery({
    queryKey: ['quoteSheetDays', quote.id],
    queryFn: () => supabaseAPI.entities.QuoteDay.filter({ quote_id: quote.id }),
    enabled: !hasSheet,
    refetchOnWindowFocus: false,
  });

  // Datos iniciales fijos para el mount.
  const initialRef = useRef(null);
  if (initialRef.current === null) {
    if (hasSheet) {
      initialRef.current = quote.sheet_data;
    } else if (!isLoading) {
      const days = [...(rawDays || [])].sort((a, b) => (a.day_index || 0) - (b.day_index || 0));
      initialRef.current = buildQuoteSheetTemplate(quote, days);
    }
  }

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

  if (!initialRef.current) {
    return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2E442A' }} /></div>;
  }

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
