-- Cotizador: portada para el cliente + link público para compartir por WhatsApp.
-- Las fotos por servicio se guardan en quote_services.meta.image_url (ya existe meta jsonb),
-- por eso aquí solo tocamos la tabla quotes.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS cover_note      text,        -- intro/portada que ve el cliente
  ADD COLUMN IF NOT EXISTS cover_image_url text,        -- imagen de portada
  ADD COLUMN IF NOT EXISTS public_token    uuid DEFAULT gen_random_uuid(),  -- token del link público
  ADD COLUMN IF NOT EXISTS published_at    timestamptz; -- cuándo se compartió por primera vez

-- Backfill: darle token a las cotizaciones que ya existían.
UPDATE public.quotes SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- El link público busca por este token; que sea único y rápido.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_token ON public.quotes(public_token);
