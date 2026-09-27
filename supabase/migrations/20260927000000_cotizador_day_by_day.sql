-- ============================================================================
-- Cotizador day-by-day (nuevo). Tablas: quotes, quote_days, quote_services,
-- markup_rules. Todo en USD; la comisión se guarda en dólares.
-- RLS deshabilitado (patrón anon-key del CRM, igual que el resto de tablas).
-- Aditivo e idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  trip_id TEXT,                           -- viaje (cotización) al que se liga, opcional
  trip_name TEXT,
  start_date DATE,
  end_date DATE,
  pax INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',            -- draft | sent | accepted | rejected
  parent_quote_id UUID,                   -- versión anterior (para historial)
  markup_overrides JSONB,                 -- reglas de markup propias de esta cotización
  accepted_sold_trip_id TEXT,             -- viaje creado al aceptar (evita duplicar)
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);
-- idempotente: por si la tabla ya existía sin trip_id
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS trip_id TEXT;

CREATE TABLE IF NOT EXISTS public.quote_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  day_index INTEGER NOT NULL,
  date DATE,
  city TEXT,
  is_free BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_quote_days_quote ON public.quote_days(quote_id);

CREATE TABLE IF NOT EXISTS public.quote_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_day_id UUID NOT NULL,
  type TEXT,                              -- hotel | vuelo | tour | traslado | tren | otro
  name TEXT,
  description TEXT,
  supplier TEXT,
  price_mode TEXT DEFAULT 'gross',        -- gross | net
  net NUMERIC(12,2),
  gross NUMERIC(12,2),
  commission NUMERIC(12,2),
  nights INTEGER,
  rooms INTEGER,
  breakfast BOOLEAN,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quote_services_day ON public.quote_services(quote_day_id);

CREATE TABLE IF NOT EXISTS public.markup_rules (
  type TEXT PRIMARY KEY,                  -- hotel | vuelo | tour | traslado | tren | otro
  mode TEXT NOT NULL,                     -- div | per_pax
  value NUMERIC(12,4) NOT NULL
);
INSERT INTO public.markup_rules (type, mode, value) VALUES
  ('hotel', 'div', 0.90),
  ('vuelo', 'per_pax', 30),
  ('tour', 'div', 0.85),
  ('traslado', 'div', 0.85),
  ('tren', 'div', 0.85),
  ('otro', 'div', 0.85)
ON CONFLICT (type) DO NOTHING;

ALTER TABLE public.quotes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_days      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_services  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.markup_rules    DISABLE ROW LEVEL SECURITY;
