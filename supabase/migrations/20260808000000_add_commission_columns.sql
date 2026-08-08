-- ============================================================================
-- Columnas de comisiones: fecha de pago al agente y registro del traspaso a Revenue
-- ============================================================================
-- Usadas por "Comisiones Internas":
--   · paid_to_agent_date      → agrupa la pestaña "Pagadas" por fecha de pago.
--   · revenue_transfer_date   → cuándo se traspasó la comisión neta de la cuenta
--     revenue_transfer_amount →   de Operaciones a Revenue, y por cuánto (auditoría).
--
-- El código ya escribe estas columnas; sin esta migración, los botones de
-- fecha de pago y de traspaso fallan con "No se pudo actualizar la comisión".
--
-- Es idempotente (IF NOT EXISTS): correrla más de una vez no hace daño.
-- ============================================================================
ALTER TABLE public.trip_services
  ADD COLUMN IF NOT EXISTS paid_to_agent_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_transfer_amount NUMERIC(12,2);
