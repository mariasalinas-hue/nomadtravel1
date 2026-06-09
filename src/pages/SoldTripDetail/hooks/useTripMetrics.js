import { useMemo } from 'react';
import { differenceInDays, isPast } from 'date-fns';
import { parseLocalDate } from '@/components/utils/dateHelpers';

export function useTripMetrics(soldTrip, services, clientPayments, supplierPayments) {
  return useMemo(() => {
    if (!soldTrip) return null;

    // Los servicios cancelados no cuentan para los totales del viaje
    const isCancelled = (s) => (s.reservation_status || s.metadata?.reservation_status) === 'cancelado';
    const activeServices = services.filter(s => !isCancelled(s));

    const totalServices = activeServices.reduce((sum, s) => sum + (s.total_price || 0), 0);
    const totalCommissions = activeServices.reduce((sum, s) => sum + (s.commission || 0), 0);
    const totalClientPaid = clientPayments.reduce((sum, p) => {
      return sum + (p.amount_usd_fixed || p.amount || 0);
    }, 0);
    const totalSupplierPaid = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calcular el total de servicios que el cliente debe pagar
    // Excluyendo los servicios marcados como "pagado" (pagados directamente al proveedor) o cancelados
    const totalServicesToPay = activeServices.reduce((sum, s) => {
      // Check reservation_status in both direct field and metadata
      const reservationStatus = s.reservation_status || s.metadata?.reservation_status;
      if (reservationStatus === 'pagado') return sum;
      return sum + (s.total_price || s.price || 0);
    }, 0);

    const clientBalance = Math.max(0, totalServicesToPay - totalClientPaid - totalSupplierPaid);
    const paymentProgress = totalServices > 0 ? Math.round((totalClientPaid / totalServices) * 100) : 0;

    const startDate = parseLocalDate(soldTrip.start_date);
    const daysUntilTrip = startDate && !isNaN(startDate.getTime()) ? differenceInDays(startDate, new Date()) : 0;
    const isTripPast = startDate && !isNaN(startDate.getTime()) ? isPast(startDate) : false;

    // Pending payment alerts
    const today = new Date();
    const pendingPaymentAlerts = services.filter(service => {
      const paymentDueDate = service.payment_due_date || service.metadata?.payment_due_date;
      if (!paymentDueDate) return false;

      // Check reservation_status in both direct field and metadata
      const reservationStatus = service.reservation_status || service.metadata?.reservation_status;
      if (reservationStatus === 'pagado' || reservationStatus === 'cancelado') return false;

      // Exclude services that already have supplier payments covering the full amount
      const serviceSupplierPayments = supplierPayments.filter(p => p.trip_service_id === service.id);
      if (serviceSupplierPayments.length > 0) {
        const totalPaidToSupplier = serviceSupplierPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const costToPay = service.payment_type === 'neto'
          ? (service.total_price || 0) - (service.commission || 0)
          : (service.total_price || 0);
        if (totalPaidToSupplier >= costToPay) return false;
      }

      const dueDate = parseLocalDate(paymentDueDate);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue <= 30;
    }).map(service => {
      const paymentDueDate = service.payment_due_date || service.metadata?.payment_due_date;
      const dueDate = parseLocalDate(paymentDueDate);
      const daysUntilDue = differenceInDays(dueDate, today);
      const isOverdue = daysUntilDue < 0;
      return { ...service, daysUntilDue, isOverdue };
    }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // Group services by type
    const servicesByType = services.reduce((acc, s) => {
      if (!acc[s.service_type]) acc[s.service_type] = [];
      acc[s.service_type].push(s);
      return acc;
    }, {});

    return {
      totalServices,
      totalCommissions,
      totalClientPaid,
      totalSupplierPaid,
      clientBalance,
      paymentProgress,
      daysUntilTrip,
      isTripPast,
      pendingPaymentAlerts,
      servicesByType
    };
  }, [soldTrip, services, clientPayments, supplierPayments]);
}
