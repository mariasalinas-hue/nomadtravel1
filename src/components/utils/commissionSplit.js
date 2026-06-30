/**
 * Reparto de comisiones con tarifa (tier) por agente.
 *
 * Reglas:
 *  - Cada agente tiene una tarifa fija (commission_rate), p. ej. 0.50, 0.55, 0.60…
 *  - La tarifa se guarda en el usuario (users.metadata.commission_rate) y es la tarifa ACTUAL.
 *  - Al pagarle la comisión al agente (paid_to_agent), se CONGELA la tarifa en el servicio
 *    (trip_services.metadata.agent_commission_rate) y ya no se recalcula: las comisiones ya
 *    pagadas quedan exactamente igual aunque luego suba la tarifa del agente.
 *  - Las comisiones aún no pagadas usan la tarifa actual del agente.
 *
 * Reparto del monto de comisión:
 *  - agente   = comisión * tarifa
 *  - Montecito = 15% fijo (solo si la reserva es de Montecito)
 *  - Nomad    = el resto (comisión − agente − Montecito)
 *  Con tarifa 0.50 esto reproduce el comportamiento anterior (agente 50, Nomad 35, Mtcto 15).
 */

export const DEFAULT_AGENT_RATE = 0.5;
export const MONTECITO_RATE = 0.15;

// Acepta 0.55 o 55 y devuelve siempre una fracción 0..1.
export function normalizeRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_AGENT_RATE;
  return n > 1 ? n / 100 : n;
}

// Tarifa ACTUAL del agente (de su usuario).
export function agentRateOf(user) {
  if (!user) return DEFAULT_AGENT_RATE;
  const raw = user.commission_rate ?? user.metadata?.commission_rate;
  return raw == null ? DEFAULT_AGENT_RATE : normalizeRate(raw);
}

// Tarifa que aplica a un servicio:
//  - ya pagado al agente  -> tarifa congelada (o 50% si es histórico sin foto)
//  - aún no pagado        -> tarifa actual del agente
export function rateForService(service, currentAgentRate) {
  if (service?.paid_to_agent) {
    const frozen = service.agent_commission_rate ?? service.metadata?.agent_commission_rate;
    return frozen == null ? DEFAULT_AGENT_RATE : normalizeRate(frozen);
  }
  return currentAgentRate == null ? DEFAULT_AGENT_RATE : normalizeRate(currentAgentRate);
}

// Reparte el monto de comisión de un servicio según la tarifa dada.
export function splitCommission(service, rate) {
  const bookedBy = service.booked_by || service.metadata?.booked_by;
  const commission = service.commission || 0;
  const r = normalizeRate(rate);
  const agent = commission * r;
  const montecito = bookedBy === 'montecito' ? commission * MONTECITO_RATE : 0;
  const nomad = Math.max(0, commission - agent - montecito);
  return { agent, nomad, montecito, bookedBy, rate: r };
}
