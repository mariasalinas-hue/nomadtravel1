-- ============================================================================
-- Cotizador (Quote Builder) — permitir que un servicio exista en una COTIZACIÓN
-- antes de que el viaje se venda.
-- ============================================================================
-- Hoy un trip_service solo cuelga de un sold_trip (viaje vendido). Para el
-- Cotizador, un servicio se crea colgado de la cotización (trips) y, al VENDER,
-- el MISMO registro recibe su sold_trip_id y pasa a Corsario (sin copiarse).
--
-- NOTA DE TIPOS: en esta base, trips.id / sold_trips.id están definidos como
-- TEXT (no uuid), así que trip_id también debe ser TEXT para poder comparar.
-- Por eso NO se agrega FK (evita el choque de tipos); la app filtra por trip_id
-- directamente y no depende de la restricción.
--
-- Cambios (aditivos e idempotentes):
--   1. trip_id TEXT → amarre a la cotización; se corrige el tipo si quedó mal.
--   2. índice por trip_id.
--   3. sold_trip_id pasa a permitir NULL (un servicio en cotización aún no tiene
--      venta). En el esquema del repo ya es NULLABLE; el DROP NOT NULL es un
--      no-op seguro si ya lo era.
-- ============================================================================

ALTER TABLE public.trip_services
  ADD COLUMN IF NOT EXISTS paid_to_agent_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_transfer_amount NUMERIC(12,2);

-- trip_id del mismo tipo que trips.id (TEXT). Corrige el tipo si una corrida
-- anterior lo dejó como uuid; preserva la columna si ya es TEXT.
DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'trip_services' AND column_name = 'trip_id';
  IF col_type IS NULL THEN
    ALTER TABLE public.trip_services ADD COLUMN trip_id TEXT;
  ELSIF col_type <> 'text' THEN
    ALTER TABLE public.trip_services DROP COLUMN trip_id;
    ALTER TABLE public.trip_services ADD COLUMN trip_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trip_services_trip_id
  ON public.trip_services(trip_id);

ALTER TABLE public.trip_services
  ALTER COLUMN sold_trip_id DROP NOT NULL;
