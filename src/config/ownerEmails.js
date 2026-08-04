/**
 * Correos de las dueñas de Nomad (Marifer Salinas y Andrea Lozano).
 * Sus comisiones se reparten distinto: reciben el 100% de las comisiones de
 * Nomad y el 85% de las de Montecito (que es el 100% de lo que Montecito le
 * paga a Nomad; Montecito retiene su 15%).
 */
export const OWNER_EMAILS = [
  'maria.salinas@nomadtravel.mx',
  'andrea.lozano@nomadtravel.mx',
];

/**
 * ¿El correo pertenece a una de las dueñas?
 * @param {string} email
 * @returns {boolean}
 */
export const isOwnerEmail = (email) => {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
};
