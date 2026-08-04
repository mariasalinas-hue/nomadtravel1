-- ============================================
-- Registro del traspaso de comisiones NETAS de la cuenta de Operaciones a la
-- cuenta de Revenue (usado en "Comisiones Internas → Cierre mensual").
--
-- Las comisiones netas entran primero a Operaciones (ahí cae el dinero del
-- cliente). Cuando el saldo del cliente cuadra con las netas se hace el
-- traspaso a Revenue; estas columnas guardan cuándo y por cuánto se hizo, para
-- tener historial auditable. Es idempotente (IF NOT EXISTS).
-- ============================================
ALTER TABLE public.trip_services
  ADD COLUMN IF NOT EXISTS revenue_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_transfer_amount NUMERIC(12,2);
