import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import esES from '@univerjs/preset-sheets-core/locales/es-ES';
import '@univerjs/preset-sheets-core/lib/index.css';

// Hoja de cálculo tipo Excel (Univer). Monta el motor en un contenedor y expone
// snapshot() para leer el workbook y guardarlo. Datos en tu Supabase.
const UniverSheet = forwardRef(function UniverSheet({ data }, ref) {
  const containerRef = useRef(null);
  const univerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.ES_ES,
      locales: { [LocaleType.ES_ES]: merge({}, esES) },
      theme: defaultTheme,
      presets: [UniverSheetsCorePreset({ container: containerRef.current })],
    });
    univerRef.current = univer;
    apiRef.current = univerAPI;
    univerAPI.createWorkbook(data);
    return () => {
      try { univer.dispose(); } catch { /* noop */ }
      univerRef.current = null;
      apiRef.current = null;
    };
    // Monta una sola vez; los datos iniciales se pasan al crear el workbook.
  }, []);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      try { return apiRef.current?.getActiveWorkbook()?.save() || null; } catch { return null; }
    },
  }), []);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default UniverSheet;
