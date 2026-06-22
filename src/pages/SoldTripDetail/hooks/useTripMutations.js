import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { supabaseAPI } from '@/api/supabaseClient';
import {
  updateSoldTripAndPaymentPlanTotals,
  updateSoldTripAndTripServiceTotals,
  updateSoldTripTotalsFromServices
} from '@/components/utils/soldTripRecalculations';

export function useTripMutations(tripId, services, clientPayments, supplierPayments) {
  const queryClient = useQueryClient();
  const { user: clerkUser } = useSpoofableUser();

  // Service Mutations
  const createServiceMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.TripService.create({
      ...data,
      created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
    }),
    onSuccess: async (newService) => {
      await updateSoldTripTotalsFromServices(newService.sold_trip_id, queryClient);
      queryClient.invalidateQueries({ queryKey: ['tripServices', tripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrip', tripId] });
    }
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripService.update(id, data),
    onSuccess: async (updatedService, variables) => {
      // Usar el sold_trip_id del servicio actualizado o del tripId del hook
      const soldTripId = updatedService?.sold_trip_id || tripId || services.find(s => s.id === variables.id)?.sold_trip_id;

      if (soldTripId) {
        await updateSoldTripTotalsFromServices(soldTripId, queryClient);
      }
      queryClient.invalidateQueries({ queryKey: ['tripServices', tripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrip', tripId] });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: ({ id, sold_trip_id }) => supabaseAPI.entities.TripService.delete(id),
    onSuccess: async (_, variables) => {
      const soldTripId = variables.sold_trip_id || tripId;

      if (soldTripId) {
        await updateSoldTripTotalsFromServices(soldTripId, queryClient);
      }
      queryClient.invalidateQueries({ queryKey: ['tripServices', tripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrip', tripId] });
    }
  });

  // Client Payment Mutations
  const createClientPaymentMutation = useMutation({
    mutationFn: async (data) => supabaseAPI.entities.ClientPayment.create({
      ...data,
      status: data.status || 'reportado', // Default status for new payments
      created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
    }),
    onSuccess: async (newPayment) => {
      await updateSoldTripAndPaymentPlanTotals(newPayment.sold_trip_id, queryClient);
    }
  });

  const updateClientPaymentMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.ClientPayment.update(id, data),
    onSuccess: async (updatedPayment, variables) => {
      // Usar el sold_trip_id del pago actualizado, del tripId del hook, o buscar en el array como fallback
      const soldTripId = updatedPayment?.sold_trip_id || tripId || clientPayments.find(p => p.id === variables.id)?.sold_trip_id;

      if (soldTripId) {
        await updateSoldTripAndPaymentPlanTotals(soldTripId, queryClient);
      }
    }
  });

  // Supplier Payment Mutations
  const createSupplierPaymentMutation = useMutation({
    mutationFn: async (data) => {
      const supplierPayment = await supabaseAPI.entities.SupplierPayment.create({
        ...data,
        created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
      });

      if (data.method === 'tarjeta_cliente') {
        await supabaseAPI.entities.ClientPayment.create({
          sold_trip_id: data.sold_trip_id,
          date: data.date,
          currency: 'USD',
          amount_original: data.amount,
          amount_usd_fixed: data.amount,
          amount: data.amount,
          method: 'tarjeta_cliente',
          notes: `Generado automáticamente por pago a proveedor: ${data.supplier}`,
          status: 'reportado',
          created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
        });
      }

      return supplierPayment;
    },
    onSuccess: async (newPayment, variables) => {
      await updateSoldTripAndTripServiceTotals(newPayment.sold_trip_id, queryClient);

      if (variables.method === 'tarjeta_cliente') {
        await updateSoldTripAndPaymentPlanTotals(newPayment.sold_trip_id, queryClient);
      }

      queryClient.invalidateQueries({ queryKey: ['supplierPayments', tripId] });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', tripId] });
    }
  });

  const updateSupplierPaymentMutation = useMutation({
    mutationFn: async ({ id, data, oldPayment }) => {
      const updatedPayment = await supabaseAPI.entities.SupplierPayment.update(id, data);

      if (data.method === 'tarjeta_cliente' && oldPayment && oldPayment.method !== 'tarjeta_cliente') {
        await supabaseAPI.entities.ClientPayment.create({
          sold_trip_id: data.sold_trip_id,
          date: data.date,
          currency: 'USD',
          amount_original: data.amount,
          amount_usd_fixed: data.amount,
          amount: data.amount,
          method: 'tarjeta_cliente',
          notes: `Generado automáticamente por pago a proveedor: ${data.supplier}`,
          status: 'reportado',
          created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
        });
      }

      return updatedPayment;
    },
    onSuccess: async (_, variables) => {
      const payment = supplierPayments.find(p => p.id === variables.id);
      if (payment?.sold_trip_id) {
        await updateSoldTripAndTripServiceTotals(payment.sold_trip_id, queryClient);

        if (variables.data.method === 'tarjeta_cliente' && variables.oldPayment.method !== 'tarjeta_cliente') {
          await updateSoldTripAndPaymentPlanTotals(payment.sold_trip_id, queryClient);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['supplierPayments', tripId] });
      queryClient.invalidateQueries({ queryKey: ['clientPayments', tripId] });
    }
  });

  // Delete Payment Mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async ({ type, id, sold_trip_id, payment }) => {
      if (type === 'client') {
        return await supabaseAPI.entities.ClientPayment.delete(id);
      } else {
        if (payment && payment.method === 'tarjeta_cliente') {
          const allClientPayments = await supabaseAPI.entities.ClientPayment.filter({ sold_trip_id });
          const autoGeneratedPayment = allClientPayments.find(cp =>
            cp.method === 'tarjeta_cliente' &&
            cp.date === payment.date &&
            cp.amount === payment.amount &&
            cp.notes?.includes(`Generado automáticamente por pago a proveedor: ${payment.supplier}`)
          );

          if (autoGeneratedPayment) {
            await supabaseAPI.entities.ClientPayment.delete(autoGeneratedPayment.id);
          }
        }

        return await supabaseAPI.entities.SupplierPayment.delete(id);
      }
    },
    onSuccess: async (_, variables) => {
      if (variables.type === 'client') {
        await updateSoldTripAndPaymentPlanTotals(variables.sold_trip_id, queryClient);
      } else if (variables.type === 'supplier') {
        await updateSoldTripAndTripServiceTotals(variables.sold_trip_id, queryClient);

        if (variables.payment?.method === 'tarjeta_cliente') {
          await updateSoldTripAndPaymentPlanTotals(variables.sold_trip_id, queryClient);
        }

        queryClient.invalidateQueries({ queryKey: ['supplierPayments', tripId] });
        queryClient.invalidateQueries({ queryKey: ['clientPayments', tripId] });
      }
    }
  });

  // Trip Mutation
  const updateTripMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.SoldTrip.update(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldTrip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
    }
  });

  // Payment Plan Mutations
  const createPaymentPlanMutation = useMutation({
    mutationFn: async (payments) => {
      return await supabaseAPI.entities.ClientPaymentPlan.bulkCreate(payments);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', tripId] });
    }
  });

  const updatePaymentPlanItemMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.ClientPaymentPlan.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', tripId] });
    }
  });

  // Notes Mutations
  const createNoteMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.TripNote.create({
      ...data,
      sold_trip_id: tripId,
      created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripNotes', tripId] });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripNote.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripNotes', tripId] });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.TripNote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripNotes', tripId] });
    }
  });

  // Documents Mutations
  const createDocumentMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.TripDocumentFile.create({
      ...data,
      created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.TripDocumentFile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripDocumentFile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
    }
  });

  // Reminders Mutations
  const createRemindersMutation = useMutation({
    mutationFn: (reminders) => {
      const remindersWithTripId = reminders.map(r => ({
        ...r,
        sold_trip_id: tripId,
        created_by: clerkUser?.primaryEmailAddress?.emailAddress || 'unknown'
      }));
      return supabaseAPI.entities.TripReminder.bulkCreate(remindersWithTripId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripReminders', tripId] });
    }
  });

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripReminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripReminders', tripId] });
    }
  });

  return {
    createServiceMutation,
    updateServiceMutation,
    deleteServiceMutation,
    createClientPaymentMutation,
    updateClientPaymentMutation,
    createSupplierPaymentMutation,
    updateSupplierPaymentMutation,
    deletePaymentMutation,
    updateTripMutation,
    createPaymentPlanMutation,
    updatePaymentPlanItemMutation,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    createDocumentMutation,
    deleteDocumentMutation,
    updateDocumentMutation,
    createRemindersMutation,
    updateReminderMutation
  };
}
