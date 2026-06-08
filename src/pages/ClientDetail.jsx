import React, { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/dateUtils';
import { parseLocalDate } from '@/components/utils/dateHelpers';
import {
  ArrowLeft, Mail, Phone, Calendar, Loader2,
  Plane, Plus, Send, Settings, Trash2,
  DollarSign, Wallet, MessageCircle, Cake
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TripForm from '@/components/trips/TripForm';
import TravelDocumentsList from '@/components/documents/TravelDocumentsList';
import ClientPreferencesForm from '@/components/clients/ClientPreferencesForm';
import CompanionsList from '@/components/clients/CompanionsList';
import SendTripFormModal from '@/components/clients/SendTripFormModal';

const SOURCE_LABELS = {
  referido: 'Referido',
  instagram: 'Instagram',
  facebook: 'Facebook',
  otro: 'Otro'
};

const PAYMENT_STATUS = {
  pagado: { label: 'Pagado', color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  parcial: { label: 'Pago parcial', color: '#B45309', bg: 'rgba(217,119,6,0.1)' },
  pendiente: { label: 'Pendiente', color: '#DC2626', bg: 'rgba(220,38,38,0.08)' }
};

const calcAge = (birthDate) => {
  const d = parseLocalDate(birthDate);
  if (!d || isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

const daysUntilBirthday = (birthDate) => {
  const d = parseLocalDate(birthDate);
  if (!d || isNaN(d.getTime())) return null;
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < todayMid) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - todayMid) / (1000 * 60 * 60 * 24));
};

function MiniStat({ icon: Icon, label, value, valueColor, sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-stone-400" />
        <p className="text-xs text-stone-500">{label}</p>
      </div>
      <p className="text-xl font-bold" style={{ color: valueColor || '#1C1C1E' }}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export default function ClientDetail() {
  const { user: clerkUser } = useSpoofableUser();

  // Convert Clerk user to app user format
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
    role: clerkUser.publicMetadata?.role || 'user',
    custom_role: clerkUser.publicMetadata?.custom_role
  } : null;

  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');

  const [formOpen, setFormOpen] = useState(false);
  const [shareTripOpen, setShareTripOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);

  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => supabaseAPI.entities.Client.filter({ id: clientId }).then(res => res[0]),
    enabled: !!clientId
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['clientTrips', clientId],
    queryFn: () => supabaseAPI.entities.Trip.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['clientDocuments', clientId],
    queryFn: () => supabaseAPI.entities.TravelDocument.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const { data: clientSoldTrips = [] } = useQuery({
    queryKey: ['clientSoldTrips', clientId],
    queryFn: () => supabaseAPI.entities.SoldTrip.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const createDocMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.TravelDocument.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDocuments', clientId] });
      toast.success('Documento guardado');
    }
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TravelDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDocuments', clientId] });
      toast.success('Documento actualizado');
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.TravelDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientDocuments', clientId] });
      toast.success('Documento eliminado');
    }
  });

  const createTripMutation = useMutation({
    mutationFn: async (tripData) => {
      const trip = await supabaseAPI.entities.Trip.create({
        ...tripData,
        client_id: clientId,
        client_name: `${client.first_name} ${client.last_name}`,
        created_by: user?.email
      });
      return trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clientTrips', clientId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setFormOpen(false);
      toast.success('Viaje creado exitosamente');
    }
  });

  const deleteTripMutation = useMutation({
    mutationFn: (tripId) => supabaseAPI.entities.Trip.delete(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clientTrips', clientId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setTripToDelete(null);
      toast.success('Viaje eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el viaje');
    }
  });

  const handleDeleteTrip = () => {
    if (tripToDelete) {
      deleteTripMutation.mutate(tripToDelete.id);
    }
  };

  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences) => supabaseAPI.entities.Client.update(clientId, { preferences }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setPreferencesOpen(false);
      toast.success('Preferencias guardadas');
    }
  });

  const updateCompanionsMutation = useMutation({
    mutationFn: (companions) => supabaseAPI.entities.Client.update(clientId, { companions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      toast.success('Acompañantes actualizados');
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Cliente no encontrado</p>
        <Link to={createPageUrl('Clients')}>
          <Button variant="link" style={{ color: '#2E442A' }}>Volver a clientes</Button>
        </Link>
      </div>
    );
  }

  // --- Client value summary (from sold trips) ---
  const validSold = clientSoldTrips.filter(t => !t.is_deleted);
  const totalSold = validSold.reduce((s, t) => s + (t.total_price || 0), 0);
  const totalPending = validSold.reduce((s, t) => s + Math.max(0, (t.total_price || 0) - (t.total_paid_by_client || 0)), 0);
  const soldCount = validSold.length;

  const nowDate = new Date();
  const datedSold = validSold
    .filter(t => t.start_date)
    .map(t => ({ ...t, _d: parseLocalDate(t.start_date) }))
    .filter(t => t._d && !isNaN(t._d.getTime()));
  const futureTrips = datedSold.filter(t => t._d > nowDate).sort((a, b) => a._d - b._d);
  const pastTrips = datedSold.filter(t => t._d <= nowDate).sort((a, b) => b._d - a._d);
  const undatedSold = validSold.filter(t => !t.start_date || !parseLocalDate(t.start_date));
  const soldForList = [...futureTrips, ...pastTrips, ...undatedSold];
  const nextTrip = futureTrips[0] || null;
  const lastTrip = pastTrips[0] || null;
  const highlightTrip = nextTrip || lastTrip;

  const age = calcAge(client.birth_date);
  const bdays = daysUntilBirthday(client.birth_date);
  const phoneDigits = (client.phone || '').replace(/\D/g, '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Clients')}>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-stone-800">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-stone-500 text-sm">Detalle del cliente</p>
        </div>
      </div>

      {/* Value summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={DollarSign} label="Total vendido" value={`$${totalSold.toLocaleString()}`} valueColor="#16A34A" />
        <MiniStat icon={Plane} label="Viajes vendidos" value={soldCount} />
        <MiniStat icon={Wallet} label="Por cobrar" value={`$${totalPending.toLocaleString()}`} valueColor={totalPending > 0 ? '#DC2626' : '#1C1C1E'} />
        <MiniStat
          icon={Calendar}
          label={nextTrip ? 'Próximo viaje' : 'Último viaje'}
          value={highlightTrip ? formatDate(highlightTrip.start_date, 'd MMM yy', { locale: es }) : '—'}
          sub={highlightTrip ? highlightTrip.destination : 'Sin viajes'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: '#2E442A' }}
              >
                {client.first_name?.[0]}{client.last_name?.[0]}
              </div>
              <div>
                <h2 className="font-semibold text-lg text-stone-800">
                  {client.first_name} {client.last_name}
                </h2>
                {client.source && (
                  <Badge variant="outline" className="mt-1">
                    {SOURCE_LABELS[client.source] || client.source}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-stone-600">
                <Mail className="w-4 h-4 text-stone-400" />
                <span className="truncate">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-3 text-stone-600">
                  <Phone className="w-4 h-4 text-stone-400" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.birth_date && (
                <div className="flex items-center gap-3 text-stone-600">
                  <Calendar className="w-4 h-4 text-stone-400" />
                  <span>
                    {formatDate(client.birth_date, 'd MMMM yyyy', { locale: es })}
                    {age !== null && <span className="text-stone-400"> · {age} años</span>}
                  </span>
                  {bdays !== null && bdays <= 30 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ color: '#BE185D', background: 'rgba(219,39,119,0.1)' }}>
                      <Cake className="w-3 h-3" />
                      {bdays === 0 ? '¡Hoy!' : bdays === 1 ? 'Mañana' : `en ${bdays}d`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick contact actions */}
            {(client.email || client.phone) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {client.email && (
                  <a href={`mailto:${client.email}`}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Mail className="w-4 h-4 mr-1.5" /> Email
                    </Button>
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`}>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Phone className="w-4 h-4 mr-1.5" /> Llamar
                    </Button>
                  </a>
                )}
                {phoneDigits && (
                  <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-xl" style={{ color: '#16A34A', borderColor: 'rgba(22,163,74,0.3)' }}>
                      <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
                    </Button>
                  </a>
                )}
              </div>
            )}

            {client.notes && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-400 mb-1">Notas</p>
                <p className="text-sm text-stone-600">{client.notes}</p>
              </div>
            )}
          </div>

          {/* Companions List */}
          <CompanionsList
            companions={client.companions || []}
            onUpdate={(companions) => updateCompanionsMutation.mutate(companions)}
            isLoading={updateCompanionsMutation.isPending}
          />

          {/* Client Preferences */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-stone-800">Preferencias del Cliente</h3>
              <Button
                onClick={() => setPreferencesOpen(true)}
                variant="ghost"
                size="icon"
                className="rounded-xl"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-stone-500">
              {client.preferences ? 'Preferencias configuradas' : 'Sin preferencias configuradas'}
            </p>
            <Button
              onClick={() => setPreferencesOpen(true)}
              variant="outline"
              className="w-full mt-3 rounded-xl"
            >
              {client.preferences ? 'Editar Preferencias' : 'Agregar Preferencias'}
            </Button>
          </div>

          {/* Send Form Link */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <h3 className="font-semibold text-stone-800 mb-3">Enviar Formulario de Viaje</h3>
            <p className="text-sm text-stone-500 mb-4">
              Manda un link al cliente para que cuente cómo, cuándo y cuánto quiere gastar. Se creará una cotización ligada a este cliente.
            </p>
            <Button
              onClick={() => setShareTripOpen(true)}
              className="w-full rounded-xl text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar formulario
            </Button>
          </div>

          {/* Travel Documents */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
            <TravelDocumentsList
              documents={documents}
              clientId={clientId}
              onCreate={(data) => createDocMutation.mutate(data)}
              onUpdate={(id, data) => updateDocMutation.mutate({ id, data })}
              onDelete={(id) => deleteDocMutation.mutate(id)}
              isCreating={createDocMutation.isPending}
              isUpdating={updateDocMutation.isPending}
            />
          </div>
        </div>

        {/* Trips & Requests */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sold trips */}
          {soldForList.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="p-4 border-b border-stone-100 flex items-center gap-2">
                <Plane className="w-4 h-4" style={{ color: '#2E442A' }} />
                <h3 className="font-semibold text-stone-800">Viajes Vendidos</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2E442A15', color: '#2E442A' }}>
                  {soldForList.length}
                </span>
              </div>
              <div className="divide-y divide-stone-100">
                {soldForList.map(trip => {
                  const st = PAYMENT_STATUS[trip.status] || PAYMENT_STATUS.pendiente;
                  return (
                    <Link
                      key={trip.id}
                      to={createPageUrl(`SoldTripDetail?id=${trip.id}`)}
                      className="block p-4 hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-stone-800 truncate">{trip.destination || trip.trip_name || 'Viaje'}</p>
                          <p className="text-xs text-stone-500">
                            {trip.start_date && formatDate(trip.start_date, 'd MMM yyyy', { locale: es })}
                            {trip.end_date && ` - ${formatDate(trip.end_date, 'd MMM yyyy', { locale: es })}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-stone-800">${(trip.total_price || 0).toLocaleString()}</p>
                          <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1" style={{ color: st.color, background: st.bg }}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Trip Button */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-stone-800">Solicitudes / Prospectos</h3>
            <Button 
              onClick={() => setFormOpen(true)}
              className="text-white rounded-xl"
              style={{ backgroundColor: '#2E442A' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Viaje
            </Button>
          </div>

          {/* Trips List */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            {trips.length === 0 ? (
              <div className="p-8 text-center">
                <Plane className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p className="text-stone-500">No hay viajes registrados</p>
                <Button 
                  onClick={() => setFormOpen(true)}
                  variant="link"
                  style={{ color: '#2E442A' }}
                >
                  Crear primer viaje
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {trips.map(trip => (
                  <div key={trip.id} className="p-4 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-stone-800">
                          {trip.trip_name || trip.destination}
                        </h4>
                        <p className="text-sm text-stone-500">
                          {trip.start_date && formatDate(trip.start_date, 'd MMM')}
                          {trip.end_date && ` - ${formatDate(trip.end_date, 'd MMM yyyy')}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="capitalize"
                        >
                          {trip.stage?.replace('_', ' ')}
                        </Badge>
                        <Button
                          onClick={() => setTripToDelete(trip)}
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {trip.mood && (
                      <p className="text-xs text-stone-400 mt-1">{trip.mood}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trip Requests History */}
          {client.trip_requests && client.trip_requests.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="p-4 border-b border-stone-100">
                <h3 className="font-semibold text-stone-800">Historial de Solicitudes</h3>
              </div>
              <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
                {client.trip_requests.map((req, idx) => (
                  <div key={idx} className="p-4 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-stone-700">{req.destination}</p>
                        <p className="text-stone-500 text-xs">
                          {req.start_date && formatDate(req.start_date, 'd MMM', { locale: es })}
                          {req.end_date && ` - ${formatDate(req.end_date, 'd MMM yyyy', { locale: es })}`}
                        </p>
                      </div>
                      <span className="text-xs text-stone-400">
                        {req.created_date && formatDate(req.created_date, 'd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trip Form */}
      <TripForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={(data) => createTripMutation.mutate(data)}
        isLoading={createTripMutation.isPending}
        prefilledClient={{
          id: clientId,
          name: `${client.first_name} ${client.last_name}`
        }}
      />

      {/* Send Trip-request Form */}
      <SendTripFormModal
        open={shareTripOpen}
        client={client}
        onClose={() => setShareTripOpen(false)}
      />

      {/* Client Preferences Form */}
      <ClientPreferencesForm
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        preferences={client.preferences || {}}
        onSave={(preferences) => updatePreferencesMutation.mutate(preferences)}
        isLoading={updatePreferencesMutation.isPending}
      />

      {/* Delete Trip Dialog */}
      <AlertDialog open={!!tripToDelete} onOpenChange={() => setTripToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar viaje?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar el viaje "{tripToDelete?.trip_name || tripToDelete?.destination}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTripMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTrip}
              disabled={deleteTripMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteTripMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}