/**
 * Utilidades de costo a proveedor para un servicio (TripService).
 *
 * El "costo a pagar al proveedor" depende de si los pagos son netos o brutos:
 *  - neto:  total_price - commission (la comisión se queda con la agencia)
 *  - bruto: total_price completo
 * Esta lógica es la misma que se muestra en ServiceCard y debe mantenerse consistente
 * en el formulario de pago y en el recálculo de totales.
 */

export function getServiceTotalPrice(service) {
  return Number(service?.total_price ?? service?.price ?? 0);
}

/**
 * Costo que se le debe al proveedor por este servicio.
 * @param {object} service
 * @param {boolean} treatAsNeto - true si el pago se considera neto
 */
export function getSupplierCostToPay(service, treatAsNeto) {
  const total = getServiceTotalPrice(service);
  const commission = Number(service?.commission ?? 0);
  return treatAsNeto ? Math.max(0, total - commission) : total;
}

/**
 * Saldo pendiente de pagar al proveedor.
 */
export function getSupplierOutstanding(service, paidToSupplier, treatAsNeto) {
  return Math.max(0, getSupplierCostToPay(service, treatAsNeto) - (Number(paidToSupplier) || 0));
}

/**
 * Calcula el estado de reservación automático según el avance de pago al proveedor.
 *  - sin pagos        -> 'reservado'
 *  - pago parcial     -> 'parcial'
 *  - pago completo    -> 'pagado'
 * Reglas de protección:
 *  - 'cancelado' nunca se modifica automáticamente.
 *  - un servicio marcado 'pagado' sin pagos registrados se respeta (pago directo al proveedor).
 */
export function computeAutoReservationStatus(currentStatus, totalPaid, costToPay) {
  if (currentStatus === 'cancelado') return 'cancelado';
  const paid = Number(totalPaid) || 0;
  const cost = Number(costToPay) || 0;
  if (cost > 0 && paid >= cost) return 'pagado';
  if (paid > 0) return 'parcial';
  // Sin pagos registrados: respetar un 'pagado' marcado a mano (pago directo)
  if (currentStatus === 'pagado') return 'pagado';
  return 'reservado';
}
