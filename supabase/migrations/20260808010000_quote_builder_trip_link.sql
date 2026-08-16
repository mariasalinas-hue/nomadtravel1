-- ============================================================================
-- Cotizador (Quote Builder) — permitir que un servicio exista en una COTIZACIÓN
-- antes de que el viaje se venda.
-- ============================================================================
-- Hoy un trip_service solo cuelga de un sold_trip (viaje vendido). Para el
-- Cotizador, un servicio se crea colgado de la cotización (trips) y, al VENDER,
-- el MISMO registro recibe su sold_trip_id y pasa a Corsario (sin copiarse).
--
-- Cambios (aditivos e idempotentes):
--   1. trip_id  → amarre a la cotización (trips), nulo mientras no aplique.
--   2. sold_trip_id pasa a permitir NULL (un servicio en cotización aún no tiene
--      venta). En el esquema del repo ya es NULLABLE; el DROP NOT NULL es un
--      no-op seguro si ya lo era.
--   3. índice por trip_id para cargar rápido los servicios de una cotización.
--   4. FK trip_id → trips(id) ON DELETE CASCADE (borrar la cotización limpia
--      sus servicios borrador).
-- ============================================================================

ALTER TABLE public.trip_services
  ADD COLUMN IF NOT EXISTS trip_id UUID;

ALTER TABLE public.trip_services
  ALTER COLUMN sold_trip_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_services_trip_id
  ON public.trip_services(trip_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trip_services_trip_id_fkey'
  ) THEN
    ALTER TABLE public.trip_services
      ADD CONSTRAINT trip_services_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;
  END IF;
END $$;
