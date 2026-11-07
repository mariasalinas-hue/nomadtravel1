import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';

// Plantilla de la Hoja (Univer) con la MISMA estructura de columnas que la Tabla:
// Día | Fecha completa | Ciudad | País | Actividad | Hotel | Vuelo | Traslado 1 |
// Traslado 2 | Tour | Tren | Crucero | Otros | Total.
// Las columnas de servicio son importes; Total (col N) = suma de F:M por fila; y una
// fila de TOTAL al final suma cada columna. Se siembra con los días reales del viaje.
export function buildQuoteSheetTemplate(quote, days = []) {
  const header = ['Día', 'Fecha completa', 'Ciudad', 'País', 'Actividad', 'Hotel', 'Vuelo', 'Traslado 1', 'Traslado 2', 'Tour', 'Tren', 'Crucero', 'Otros', 'Total'];
  const cellData = { 0: {} };
  header.forEach((h, i) => { cellData[0][i] = { v: h, s: 'hdr' }; });

  const rows = Math.max(days.length, 1);
  for (let i = 0; i < rows; i++) {
    const r = i + 1;          // fila (0-indexed)
    const excelRow = r + 1;   // fila en la hoja (1-indexed; la 1 es el encabezado)
    const d = days[i];
    cellData[r] = {
      0: { v: i + 1 },
      1: { v: d?.date ? formatDate(d.date, "EEEE d MMMM yyyy", { locale: es }) : '' },
      2: { v: d?.city || '' },
      3: { v: d?.country || '' },
      4: { v: d?.activity || '' },
      13: { f: `=SUM(F${excelRow}:M${excelRow})` }, // Total por día
    };
  }

  // Fila de totales (suma por columna).
  const totalRow = rows + 1;
  const first = 2, last = rows + 1; // filas de datos en la hoja
  const totals = {};
  ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col, idx) => {
    totals[5 + idx] = { f: `=SUM(${col}${first}:${col}${last})`, s: 'tot' };
  });
  cellData[totalRow] = { 4: { v: 'TOTAL', s: 'tot' }, ...totals };

  return {
    id: `quote-${quote.id}`,
    name: quote.trip_name || 'Cotización',
    sheetOrder: ['s1'],
    styles: {
      hdr: { bl: 1, bg: { rgb: '#2E442A' }, cl: { rgb: '#ffffff' } },
      tot: { bl: 1 },
    },
    sheets: {
      s1: {
        id: 's1',
        name: 'Cotización',
        cellData,
        rowCount: Math.max(200, rows + 10),
        columnCount: 16,
        columnData: {
          1: { w: 170 }, 2: { w: 130 }, 3: { w: 110 }, 4: { w: 160 },
          5: { w: 90 }, 6: { w: 90 }, 7: { w: 95 }, 8: { w: 95 }, 9: { w: 85 }, 10: { w: 80 }, 11: { w: 90 }, 12: { w: 80 }, 13: { w: 100 },
        },
      },
    },
  };
}
