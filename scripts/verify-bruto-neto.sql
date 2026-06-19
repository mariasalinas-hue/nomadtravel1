-- =====================================================================
-- Verificación: comisiones marcadas como BRUTA que probablemente son NETA
-- Correr en Supabase → SQL Editor (solo SELECT, no modifica nada).
--
-- Idea: el "tipo" real se refleja en cómo se pagó al proveedor
-- (supplier_payments.payment_type). Si el servicio se trata como bruta
-- pero al proveedor se le pagó en neto, está mal clasificado.
-- =====================================================================

-- 1) Resumen general: cómo están clasificadas hoy las comisiones (> 0)
select
  coalesce(payment_type, '(sin tipo -> cuenta como BRUTA)') as tipo_servicio,
  count(*)                                  as servicios,
  round(sum(commission)::numeric, 2)        as comision_total
from trip_services
where commission > 0
group by 1
order by 2 desc;

-- 2) SOSPECHOSAS: hoy cuentan como BRUTA (tipo nulo o 'bruto'),
--    pero al proveedor se le pagó en NETO -> probablemente deberían ser NETAS.
select
  st.client_name,
  st.destination,
  st.created_by                                          as agente,
  ts.id                                                  as service_id,
  ts.service_type,
  coalesce(ts.payment_type, '(null)')                    as tipo_actual_servicio,
  ts.commission,
  count(sp.*) filter (where sp.payment_type = 'neto')    as pagos_neto,
  count(sp.*) filter (where sp.payment_type = 'bruto')   as pagos_bruto,
  round(sum(sp.amount)::numeric, 2)                      as total_pagado_proveedor
from trip_services ts
join supplier_payments sp on sp.trip_service_id = ts.id
left join sold_trips st     on st.id = ts.sold_trip_id
where ts.commission > 0
  and coalesce(ts.payment_type, 'bruto') <> 'neto'        -- hoy se trata como bruta
group by st.client_name, st.destination, st.created_by,
         ts.id, ts.service_type, ts.payment_type, ts.commission
having count(sp.*) filter (where sp.payment_type = 'neto') > 0   -- pero se pagó neto
order by ts.commission desc;

-- 3) Conteo rápido de cuántas son sospechosas y cuánta comisión representan
select
  count(*)                            as servicios_sospechosos,
  round(sum(ts.commission)::numeric, 2) as comision_afectada
from (
  select ts.id, ts.commission
  from trip_services ts
  join supplier_payments sp on sp.trip_service_id = ts.id
  where ts.commission > 0
    and coalesce(ts.payment_type, 'bruto') <> 'neto'
  group by ts.id, ts.commission
  having count(sp.*) filter (where sp.payment_type = 'neto') > 0
) ts;

-- =====================================================================
-- (OPCIONAL) Corrección — NO correr hasta revisar el resultado de (2).
-- Marca como 'neto' los servicios cuyo proveedor se pagó en neto.
-- Revisa primero la lista; si hay casos legítimos de bruta, exclúyelos.
-- =====================================================================
-- update trip_services ts
-- set payment_type = 'neto'
-- where ts.commission > 0
--   and coalesce(ts.payment_type, 'bruto') <> 'neto'
--   and exists (
--     select 1 from supplier_payments sp
--     where sp.trip_service_id = ts.id and sp.payment_type = 'neto'
--   );
