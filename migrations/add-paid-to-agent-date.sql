-- ============================================
-- Agrega la fecha en que se le pagó la comisión al agente.
-- Se usa en "Comisiones Internas" para agrupar la pestaña "Pagadas" por
-- fecha de pago. Es idempotente (IF NOT EXISTS).
-- ============================================
ALTER TABLE public.trip_services
  ADD COLUMN IF NOT EXISTS paid_to_agent_date DATE;
