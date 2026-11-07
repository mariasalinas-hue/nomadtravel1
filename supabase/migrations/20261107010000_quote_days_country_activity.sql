-- Cotizador (tabla día por día): ciudad y país por separado + nota de actividad.
ALTER TABLE public.quote_days
  ADD COLUMN IF NOT EXISTS country  text,
  ADD COLUMN IF NOT EXISTS activity text;
