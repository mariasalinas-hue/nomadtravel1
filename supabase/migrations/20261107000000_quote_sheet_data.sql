-- Cotizador: hoja de cálculo (Univer) por cotización. Guarda el workbook completo
-- como JSON para que persista y se reabra igual. No afecta el planner día-por-día.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS sheet_data jsonb;
