-- Backfill sold_trips.total_price from the sum of each trip's services.
--
-- Why: the totals recalculation used to read the wrong column (the legacy
-- trip_services.total_price instead of trip_services.price), which stored
-- sold_trips.total_price = 0 on every recalculated trip. This rebuilds the
-- correct total from the real `price` column.
--
-- Safe: only updates trips that have services; additive, no deletes.

UPDATE public.sold_trips st
SET total_price = COALESCE(sub.sum_price, 0)
FROM (
  SELECT sold_trip_id, SUM(COALESCE(price, total_price, 0)) AS sum_price
  FROM public.trip_services
  GROUP BY sold_trip_id
) sub
WHERE st.id = sub.sold_trip_id;
