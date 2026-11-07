// Plantilla de la hoja de cotización (reglas preescritas): encabezados, columna de
// comisión = Bruto − Neto en cada fila, y fila de totales con SUMAs.
export function buildQuoteSheetTemplate(quote) {
  const header = ['Día', 'Ciudad', 'Tipo', 'Servicio', 'Proveedor', 'Neto', 'Bruto', 'Comisión'];
  const DATA_ROWS = 40;

  const cellData = { 0: {} };
  header.forEach((h, i) => { cellData[0][i] = { v: h, s: 'hdr' }; });

  // Comisión por fila (col H = G - F), fórmula pre-escrita.
  for (let r = 1; r <= DATA_ROWS; r++) {
    cellData[r] = { 7: { f: `=G${r + 1}-F${r + 1}` } };
  }

  // Fila de totales.
  const totalRow = DATA_ROWS + 1; // 0-indexed → deja una fila de respiro
  cellData[totalRow] = {
    4: { v: 'TOTAL' },
    5: { f: `=SUM(F2:F${DATA_ROWS + 1})` },
    6: { f: `=SUM(G2:G${DATA_ROWS + 1})` },
    7: { f: `=SUM(H2:H${DATA_ROWS + 1})` },
  };

  return {
    id: `quote-${quote.id}`,
    name: quote.trip_name || 'Cotización',
    sheetOrder: ['s1'],
    styles: {
      hdr: { bl: 1, bg: { rgb: '#2E442A' }, cl: { rgb: '#ffffff' } },
    },
    sheets: {
      s1: {
        id: 's1',
        name: 'Cotización',
        cellData,
        rowCount: 200,
        columnCount: 12,
        columnData: {
          3: { w: 180 }, // Servicio
          4: { w: 150 }, // Proveedor
          5: { w: 100 }, 6: { w: 100 }, 7: { w: 110 },
        },
      },
    },
  };
}
