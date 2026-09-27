-- Cotizador: campos ricos por tipo de servicio (aerolínea, cadena, escalas,
-- maletas, cabina, etc.) guardados en una sola columna JSONB, como los
-- servicios de Corsario guardan sus extras en metadata. Idempotente.
ALTER TABLE public.quote_services ADD COLUMN IF NOT EXISTS meta JSONB;
