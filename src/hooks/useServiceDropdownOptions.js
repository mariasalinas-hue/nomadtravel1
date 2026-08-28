import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAPI } from '@/api/supabaseClient';

export const DROPDOWN_CATEGORIES = {
  airline: { label: 'Aerolíneas', serviceType: 'vuelo' },
  hotel_chain: { label: 'Cadenas Hoteleras', serviceType: 'hotel' },
  hotel_reserved_by: { label: 'Reservado por (Hotel)', serviceType: 'hotel' },
  cruise_line: { label: 'Líneas de Crucero', serviceType: 'crucero' },
  cruise_ship: { label: 'Barcos / Cruceros', serviceType: 'crucero' },
  cruise_provider: { label: 'Proveedores de Crucero', serviceType: 'crucero' },
  flight_consolidator_nomad: { label: 'Consolidadores de Vuelo (Nomad)', serviceType: 'vuelo' },
  train_provider: { label: 'Proveedores de Tren', serviceType: 'tren' },
};

const QUERY_KEY = 'service_dropdown_options';

export function useServiceDropdownOptions() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => supabaseAPI.entities.ServiceDropdownOption.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useServiceDropdownByCategory(category) {
  const { data: allOptions = [], ...rest } = useServiceDropdownOptions();
  const options = allOptions.filter(o => o.category === category && o.is_active);
  return { data: options, ...rest };
}

export function useCreateServiceDropdownOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => supabaseAPI.entities.ServiceDropdownOption.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateServiceDropdownOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => supabaseAPI.entities.ServiceDropdownOption.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteServiceDropdownOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => supabaseAPI.entities.ServiceDropdownOption.hardDelete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
