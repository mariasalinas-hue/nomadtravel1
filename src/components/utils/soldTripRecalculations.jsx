import { supabaseAPI } from "@/api/supabaseClient";

/**
 * Recalcula todos los totales para un SoldTrip y actualiza los ítems de ClientPaymentPlan.
 * Esta función debe llamarse después de que cualquier ClientPayment sea creado, actualizado o eliminado.
 */
export async function updateSoldTripAndPaymentPlanTotals(soldTripId, queryClient) {
  if (!soldTripId) return;

  try {
    // Obtener los datos más recientes
    const [soldTrips, newClientPayments, paymentPlan] = await Promise.all([
      supabaseAPI.entities.SoldTrip.filter({ id: soldTripId }),
      supabaseAPI.entities.ClientPayment.filter({ sold_trip_id: soldTripId }),
      supabaseAPI.entities.ClientPaymentPlan.filter({ sold_trip_id: soldTripId })
    ]);

    const soldTrip = soldTrips[0];
    if (!soldTrip) return;

    const totalPaidByClient = newClientPayments.reduce((sum, p) => sum + (p.amount_usd_fixed || p.amount || 0), 0);
    const totalPrice = soldTrip.total_price || 0;

    // Actualizar el estado del SoldTrip
    let newStatus = 'pendiente';
    if (totalPaidByClient >= totalPrice && totalPrice > 0) {
      newStatus = 'pagado';
    } else if (totalPaidByClient > 0) {
      newStatus = 'parcial';
    }

    // Actualizar la entidad SoldTrip
    await supabaseAPI.entities.SoldTrip.update(soldTripId, {
      total_paid_by_client: totalPaidByClient,
      status: newStatus
    });

    // Actualizar los ítems del ClientPaymentPlan
    if (paymentPlan.length > 0) {
      const sortedPlan = paymentPlan.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

      let remainingAmountToAllocate = totalPaidByClient;

      for (const planItem of sortedPlan) {
        const amountDue = planItem.amount_due;
        let amountPaidForThisItem = 0;

        if (remainingAmountToAllocate > 0) {
          const amountToApply = Math.min(remainingAmountToAllocate, amountDue);
          amountPaidForThisItem = amountToApply;
          remainingAmountToAllocate -= amountToApply;
        }

        const newPlanStatus = amountPaidForThisItem >= amountDue ? 'pagado' : (amountPaidForThisItem > 0 ? 'parcial' : 'pendiente');

        await supabaseAPI.entities.ClientPaymentPlan.update(planItem.id, { 
          amount_paid: amountPaidForThisItem, 
          status: newPlanStatus 
        });
      }
    }

    // Invalidar queries relevantes
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['soldTrip', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['allClientPayments'] });
    }

  } catch (error) {
    console.error('Error actualizando totales de SoldTrip y Plan de Pagos:', error);
  }
}

/**
 * Recalcula los totales para un SoldTrip y actualiza amount_paid_to_supplier para los ítems de TripService.
 * Esta función debe llamarse después de que cualquier SupplierPayment sea creado, actualizado o eliminado.
 */
export async function updateSoldTripAndTripServiceTotals(soldTripId, queryClient) {
  if (!soldTripId) return;

  try {
    // Obtener los datos más recientes
    const [newServices, newSupplierPayments] = await Promise.all([
      supabaseAPI.entities.TripService.filter({ sold_trip_id: soldTripId }),
      supabaseAPI.entities.SupplierPayment.filter({ sold_trip_id: soldTripId })
    ]);

    // Los servicios cancelados no cuentan para los totales del viaje
    const activeServices = newServices.filter(s => (s.reservation_status || s.metadata?.reservation_status) !== 'cancelado');
    const totalPrice = activeServices.reduce((sum, s) => sum + (s.price || s.total_price || 0), 0);
    const totalCommission = activeServices.reduce((sum, s) => sum + (s.commission || 0), 0);
    const totalPaidToSuppliers = newSupplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Actualizar la entidad SoldTrip
    await supabaseAPI.entities.SoldTrip.update(soldTripId, {
      total_price: totalPrice,
      total_commission: totalCommission,
      total_paid_to_suppliers: totalPaidToSuppliers,
    });

    // Actualizar amount_paid_to_supplier en TripService
    for (const service of newServices) {
      const servicePayments = newSupplierPayments.filter(p => p.trip_service_id === service.id);
      const totalPaidForService = servicePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      if (service.amount_paid_to_supplier !== totalPaidForService) {
        await supabaseAPI.entities.TripService.update(service.id, {
          amount_paid_to_supplier: totalPaidForService
        });
      }
    }

    // Invalidar queries relevantes
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['soldTrip', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
      queryClient.invalidateQueries({ queryKey: ['tripServices', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
      queryClient.invalidateQueries({ queryKey: ['supplierPayments', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['allSupplierPayments'] });
    }

  } catch (error) {
    console.error('Error actualizando totales de SoldTrip y TripService:', error);
  }
}

/**
 * Recalcula total_price y total_commission de un SoldTrip después de una operación en TripService.
 */
export async function updateSoldTripTotalsFromServices(soldTripId, queryClient) {
  if (!soldTripId) return;

  try {
    const services = await supabaseAPI.entities.TripService.filter({ sold_trip_id: soldTripId });
    // Los servicios cancelados no cuentan para los totales del viaje
    const activeServices = services.filter(s => (s.reservation_status || s.metadata?.reservation_status) !== 'cancelado');
    const totalPrice = activeServices.reduce((sum, s) => sum + (s.price || s.total_price || 0), 0);
    const totalCommission = activeServices.reduce((sum, s) => sum + (s.commission || 0), 0);

    await supabaseAPI.entities.SoldTrip.update(soldTripId, {
      total_price: totalPrice,
      total_commission: totalCommission,
    });

    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['soldTrip', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
      queryClient.invalidateQueries({ queryKey: ['tripServices', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', soldTripId] });
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', soldTripId] });
    }
  } catch (error) {
    console.error('Error actualizando totales de SoldTrip desde servicios:', error);
  }
}