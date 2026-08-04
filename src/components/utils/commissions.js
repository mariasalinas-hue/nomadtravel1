import { isOwnerEmail } from '@/config/ownerEmails';

// El agente regular siempre recibe 50% del total de la comisión.
export const AGENT_RATE = 0.5;

// Reparto de la comisión entre agente, Nomad y Montecito.
//
// Agentes regulares:
//   · IATA Nomad  → agente 50%, Nomad 50%
//   · Montecito   → agente 50%, Nomad 35%, Montecito 15%
//
// Dueñas (Marifer Salinas y Andrea Lozano) — reciben el 100% de lo que le queda
// a Nomad porque son las dueñas:
//   · IATA Nomad  → agente 100% (Nomad 0%)
//   · Montecito   → agente 85% (Montecito retiene su 15%; ese 85% es el 100%
//                   de lo que Montecito le paga a Nomad)
//
// `agentEmail` es el correo del agente dueño del viaje (trip.created_by).
export const splitFor = (service, agentEmail) => {
  const bookedBy = service.booked_by || service.metadata?.booked_by;
  const commission = service.commission || 0;
  const isMontecito = bookedBy === 'montecito';
  const isOwner = isOwnerEmail(agentEmail);

  if (isOwner) {
    if (isMontecito) {
      return { agent: commission * 0.85, nomad: 0, montecito: commission * 0.15, bookedBy, isOwner: true };
    }
    return { agent: commission, nomad: 0, montecito: 0, bookedBy, isOwner: true };
  }

  const agent = commission * AGENT_RATE;
  if (isMontecito) {
    return { agent, nomad: commission * 0.35, montecito: commission * 0.15, bookedBy, isOwner: false };
  }
  return { agent, nomad: commission * 0.5, montecito: 0, bookedBy, isOwner: false };
};

// Porcentaje que le toca al agente (para etiquetas). 50, 85 o 100.
export const agentPct = (split, commission) => {
  if (!(commission > 0)) return Math.round(AGENT_RATE * 100);
  return Math.round((split.agent / commission) * 100);
};
