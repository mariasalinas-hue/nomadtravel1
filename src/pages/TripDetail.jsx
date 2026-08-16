import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, MapPin, Calendar, Users, DollarSign,
  Loader2, Edit2, Sparkles, Table2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TripForm from '@/components/trips/TripForm';
import TravelDocumentsList from '@/components/documents/TravelDocumentsList';

const STAGE_CONFIG = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
  cotizando: { label: 'Cotizando', color: 'bg-yellow-100 text-yellow-700' },
  propuesta_enviada: { label: 'Propuesta Enviada', color: 'bg-purple-100 text-purple-700' },
  aceptado: { label: 'Aceptado', color: 'bg-green-100 text-green-700' },
  vendido: { label: 'Vendido', color: 'bg-emerald-100 text-emerald-700' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-700' }
};

export default function TripDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');
  
  const [formOpen, setFormOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => supabaseAPI.entities.Trip.filter({ id: tripId }).then(res => res[0]),
    enabled: !!tripId
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => supabaseAPI.entities.Client.list()
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['tripDocuments', tripId],
    queryFn: () => supabaseAPI.entities.TravelDocument.filter({ trip_id: tripId }),
    enabled: !!tripId
  });

  const updateMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.Trip.update(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      setFormOpen(false);
      toast.success('Viaje actualizado');
    }
  });

  const createDocMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.TravelDocument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
      toast.success('Documento guardado');
    }
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TravelDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
      toast.success('Documento actualizado');
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.TravelDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
      toast.success('Documento eliminado');
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Viaje no encontrado</p>
        <Link to={createPageUrl('Trips')}>
          <Button variant="link" style={{ color: '#2E442A' }}>Volver a viajes</Button>
        </Link>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[trip.stage] || STAGE_CONFIG.nuevo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Trips')}>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-stone-800">
            {trip.trip_name || trip.destination}
          </h1>
          <p className="text-stone-500 text-sm">{trip.client_name}</p>
        </div>
        <Button
          onClick={() => window.open(`${createPageUrl('QuoteBuilder')}?trip_id=${tripId}`, '_blank')}
          className="rounded-xl text-white"
          style={{ backgroundColor: '#2E442A' }}
        >
          <Table2 className="w-4 h-4 mr-2" />
          Abrir Cotizador
        </Button>
        <Button
          onClick={() => setFormOpen(true)}
          variant="outline"
          className="rounded-xl"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trip Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-6">
              <Badge className={stageConfig.color}>
                {stageConfig.label}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-stone-400 mt-0.5" />
                <div>
                  <p className="text-xs text-stone-400">Destino</p>
                  <p className="text-stone-800 font-medium">{trip.destination}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-stone-400 mt-0.5" />
                <div>
                  <p className="text-xs text-stone-400">Fechas</p>
                  <p className="text-stone-800">
                    {trip.start_date && formatDate(trip.start_date, 'd MMM', { locale: es })}
                    {trip.end_date && ` - ${formatDate(trip.end_date, 'd MMM yyyy', { locale: es })}`}
                  </p>
                </div>
              </div>

              {trip.travelers && (
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-stone-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-stone-400">Viajeros</p>
                    <p className="text-stone-800">{trip.travelers} personas</p>
                  </div>
                </div>
              )}

              {trip.budget && (
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-stone-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-stone-400">Presupuesto</p>
                    <p className="text-stone-800">${trip.budget.toLocaleString()} USD</p>
                  </div>
                </div>
              )}

              {trip.mood && (
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-stone-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-stone-400">Mood</p>
                    <p className="text-stone-800">{trip.mood}</p>
                  </div>
                </div>
              )}
            </div>

            {trip.notes && (
              <div className="mt-6 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Notas</p>
                <p className="text-sm text-stone-600">{trip.notes}</p>
              </div>
            )}

            {trip.stage === 'perdido' && trip.lost_reason && (
              <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600 font-medium mb-1">Motivo de pérdida</p>
                <p className="text-sm text-red-700">{trip.lost_reason}</p>
              </div>
            )}
          </div>

          {/* Client Link */}
          {trip.client_id && (
            <Link to={createPageUrl(`ClientDetail?id=${trip.client_id}`)}>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 hover:bg-stone-50 transition-colors">
                <p className="text-xs text-stone-400 mb-1">Cliente</p>
                <p className="font-medium text-stone-800">{trip.client_name}</p>
                <p className="text-xs text-stone-500 mt-1">Ver detalle →</p>
              </div>
            </Link>
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <TravelDocumentsList
              documents={documents}
              clientId={trip.client_id}
              tripId={tripId}
              onCreate={(data) => createDocMutation.mutate(data)}
              onUpdate={(id, data) => updateDocMutation.mutate({ id, data })}
              onDelete={(id) => deleteDocMutation.mutate(id)}
              isCreating={createDocMutation.isPending}
              isUpdating={updateDocMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <TripForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        trip={trip}
        clients={clients}
        onSave={(data) => updateMutation.mutate(data)}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}