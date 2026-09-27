# Prototipo del cotizador day-by-day

El prototipo funcional (HTML de una sola página) vive en el artifact:
https://claude.ai/artifact/SZ2q7vy1rotLZzoCHscwyH

Se usa como referencia de **comportamiento y estructura de datos**, NO de estilo
(colores y fuentes del prototipo no se usan; todo va con el design system del CRM).

La lógica pura equivalente (reglas de markup, precios bruto/neto, cobertura de
hoteles multinoche, totales y faltantes) está portada a `src/lib/quoteEngine.js`.

## Reglas de markup (default)
- hotel: neto ÷ 0.90
- vuelo: neto + 30 por pasajero
- tour / traslado / tren / otro: neto ÷ 0.85
- comisión sobre bruto: 8.5% (cuando el precio se captura en bruto)
- si el precio es neto: comisión = bruto − neto

## Modelo de datos (Supabase)
Ver `supabase/migrations/20260927000000_cotizador_day_by_day.sql`:
`quotes`, `quote_days`, `quote_services`, `markup_rules`.
