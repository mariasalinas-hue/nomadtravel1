-- Cotizador: opciones alternativas de un servicio (Opción 1 / Opción 2 de hotel, etc.).
-- Los servicios de un mismo "slot" comparten option_group; is_selected marca cuál
-- cuenta al total por default. En el link, el cliente ve todas las opciones del grupo.

ALTER TABLE public.quote_services
  ADD COLUMN IF NOT EXISTS option_group text,                    -- id del grupo de opciones (null = servicio normal)
  ADD COLUMN IF NOT EXISTS option_label text,                    -- "Opción 1", "Opción 2"...
  ADD COLUMN IF NOT EXISTS is_selected  boolean DEFAULT true;    -- opción elegida por default (la que suma al total)

-- Los servicios que ya existen son "elegidos" por default.
UPDATE public.quote_services SET is_selected = true WHERE is_selected IS NULL;
