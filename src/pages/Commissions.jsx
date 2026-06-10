import { useState, useContext } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ViewModeContext } from '@/Layout';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { formatDate } from '@/lib/dateUtils';
import { updateSoldTripTotalsFromServices } from '@/components/utils/soldTripRecalculations';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2, Search, DollarSign,
  Check, X, FileText, Trash2
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import AgentInvoiceGenerator from '@/components/commissions/AgentInvoiceGenerator';

const BOOKED_BY_LABELS = {
  montecito: 'Montecito',
  iata_nomad: 'IATA Nomad'
};

const RESERVED_BY_LABELS = {
  virtuoso: 'Virtuoso',
  preferred_partner: 'Preferred Partner',
  tbo: 'TBO',
  expedia_taap: 'Expedia TAAP',
  ratehawk: 'RateHawk',
  tablet_hotels: 'Tablet Hotels',
  dmc: 'DMC',
  otro: 'Otro'
};

const SERVICE_TYPE_LABELS = {
  hotel: 'Hotel',
  vuelo: 'Vuelo',
  traslado: 'Traslado',
  tour: 'Tour',
  crucero: 'Crucero',
  tren: 'Tren',
  dmc: 'DMC',
  otro: 'Otro'
};

const CRUISE_PROVIDER_LABELS = {
  creative_travel: 'Creative Travel',
  directo: 'Directo',
  international_cruises: 'International Cruises',
  cruceros_57: 'Cruceros 57',
  pema: 'PeMA'
};

export default function Commissions() {
  const { viewMode, isActualAdmin } = useContext(ViewModeContext);
  const { user: clerkUser } = useSpoofableUser();

  // Convert Clerk user to app user format
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
    custom_role: clerkUser.publicMetadata?.custom_role
  } : null;

  const [search, setSearch] = useState('');
  const [filterBookedBy, setFilterBookedBy] = useState('all');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [activeTab, setActiveTab] = useState('pendientes');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [editValues, setEditValues] = useState({});

  const queryClient = useQueryClient();

  // Admin real viene del allowlist de emails (ViewModeContext), no de Clerk publicMetadata
  const isAdmin = isActualAdmin && viewMode === 'admin';

  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['allServices', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      const allTrips = isAdmin
        ? await supabaseAPI.entities.SoldTrip.list()
        : await supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
      const tripIds = allTrips.map(t => t.id);
      const allSvcs = await supabaseAPI.entities.TripService.list();
      return allSvcs.filter(s => tripIds.includes(s.sold_trip_id));
    },
    enabled: !!user,
    refetchOnWindowFocus: true
  });

  const { data: allSoldTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list();
      return supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
    },
    enabled: !!user,
    refetchOnWindowFocus: true
  });

  const soldTrips = allSoldTrips;
  const services = allServices;

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
    }
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (service) => supabaseAPI.entities.TripService.delete(service.id),
    onSuccess: async (_, service) => {
      // El total del viaje (precio/comisión) depende de los servicios: recalcular
      if (service?.sold_trip_id) {
        await updateSoldTripTotalsFromServices(service.sold_trip_id, queryClient);
      }
      queryClient.invalidateQueries({ queryKey: ['allServices'] });
      queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
      setDeleteConfirm(null);
    }
  });

  const togglePaid = (service, newValue) => {
    // Pagar al agente implica que la agencia ya recibió la comisión:
    // mantener commission_paid/paid_to_agency en sincronía con Comisiones Internas
    const data = newValue
      ? {
          paid_to_agent: true,
          commission_paid: true,
          paid_to_agency: true,
          paid_to_agency_date: service.paid_to_agency_date || new Date().toISOString().split('T')[0]
        }
      : { paid_to_agent: false };
    updateServiceMutation.mutate({ id: service.id, data });
  };

  const startEditing = (service) => {
    setEditingService(service.id);
    setEditValues({
      commission: service.commission || 0,
      commission_payment_date: service.commission_payment_date || ''
    });
  };

  const cancelEditing = () => {
    setEditingService(null);
    setEditValues({});
  };

  const saveEditing = (service) => {
    const commission = parseFloat(editValues.commission);
    if (isNaN(commission) || commission < 0) {
      toast.error('El monto debe ser un número válido mayor o igual a cero');
      return;
    }

    if (editValues.commission_payment_date && isNaN(new Date(editValues.commission_payment_date).getTime())) {
      toast.error('La fecha no es válida');
      return;
    }

    updateServiceMutation.mutate(
      {
        id: service.id,
        data: {
          commission: commission,
          commission_payment_date: editValues.commission_payment_date || null
        }
      },
      {
        // El total de comisión del viaje depende de los servicios: recalcular
        onSuccess: () => updateSoldTripTotalsFromServices(service.sold_trip_id, queryClient)
      }
    );

    setEditingService(null);
    setEditValues({});
  };

  // Create a map of sold trips for quick lookup
  const tripsMap = soldTrips.reduce((acc, trip) => {
    acc[trip.id] = trip;
    return acc;
  }, {});

  const getServiceName = (service) => {
    const m = service.metadata || {};
    switch (service.service_type) {
      case 'hotel':
        return service.hotel_name || m.hotel_name || service.service_name || service.hotel_chain || m.hotel_chain || 'Hotel';
      case 'vuelo':
        return service.airline || m.airline || service.service_name || 'Vuelo';
      case 'traslado': {
        const origin = service.transfer_origin || m.transfer_origin || '';
        const dest = service.transfer_destination || m.transfer_destination || '';
        return (origin || dest) ? `${origin} → ${dest}` : (service.service_name || 'Traslado');
      }
      case 'tour':
        return service.tour_name || m.tour_name || service.service_name || 'Tour';
      case 'crucero':
        return service.cruise_ship || m.cruise_ship || service.cruise_line || m.cruise_line || service.service_name || 'Crucero';
      case 'tren':
        return `${service.train_operator || m.train_operator || 'Tren'} ${service.train_number || m.train_number || ''}`.trim() || service.service_name || 'Tren';
      case 'dmc':
        return service.dmc_name || m.dmc_name || service.service_name || 'DMC';
      case 'otro':
        return service.other_name || m.other_name || service.other_description || m.other_description || service.service_name || 'Servicio';
      default:
        return service.service_name || 'Servicio';
    }
  };

  // Filter and sort services
  const allFilteredServices = services
    .filter(s => s.commission > 0) // Only show services with commission
    .filter(s => {
      const trip = tripsMap[s.sold_trip_id];
      const clientName = trip?.client_name || '';
      const q = search.toLowerCase();
      const matchesSearch = clientName.toLowerCase().includes(q) ||
                           getServiceName(s).toLowerCase().includes(q);
      const matchesBookedBy = filterBookedBy === 'all' || (s.booked_by || s.metadata?.booked_by) === filterBookedBy;
      return matchesSearch && matchesBookedBy;
    })
    .sort((a, b) => {
      const dateA = a.commission_payment_date ? new Date(a.commission_payment_date) : new Date(0);
      const dateB = b.commission_payment_date ? new Date(b.commission_payment_date) : new Date(0);
      return dateA - dateB;
    });

  // Filter by tab (pendientes/confirmadas/pagadas)
  const filteredServices = allFilteredServices.filter(s => {
    if (activeTab === 'pendientes') {
      return !s.paid_to_agency;
    } else if (activeTab === 'confirmadas') {
      return s.paid_to_agency && !s.paid_to_agent;
    } else if (activeTab === 'pagadas') {
      return s.paid_to_agent;
    }
    return true;
  });

  // Calculate commissions
  const totalCommissionsFull = allFilteredServices.reduce((sum, s) => sum + (s.commission || 0), 0); // 100% comisiones totales
  const agentCommissionRate = 0.5; // 50% para el agente
  const agentCommissionTotal = totalCommissionsFull * agentCommissionRate; // Comisión a pagar al agente
  const paidCommissions = allFilteredServices.filter(s => s.paid_to_agent).reduce((sum, s) => sum + ((s.commission || 0) * agentCommissionRate), 0);
  const confirmedCommissions = allFilteredServices.filter(s => s.paid_to_agency && !s.paid_to_agent).reduce((sum, s) => sum + ((s.commission || 0) * agentCommissionRate), 0);
  const pendingCommissions = allFilteredServices.filter(s => !s.paid_to_agency).reduce((sum, s) => sum + ((s.commission || 0) * agentCommissionRate), 0);

  // Solo los seleccionados visibles entran a la factura (la búsqueda/pestaña puede ocultar otros)
  const selectedVisibleServices = filteredServices.filter(s => selectedServices.includes(s.id));

  const isLoading = servicesLoading || tripsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Comisiones</h1>
          <p className="text-stone-500 text-sm mt-1">Control de comisiones por servicio</p>
        </div>
        <Button
          onClick={() => setInvoiceDialogOpen(true)}
          disabled={selectedVisibleServices.length === 0}
          className="text-white"
          style={{ backgroundColor: '#2E442A' }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Generar Factura ({selectedVisibleServices.length})
        </Button>
      </div>

      {/* Instructions Box */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <h3 className="font-bold text-stone-800 mb-3 flex items-center gap-2">
          <span className="text-blue-600">ℹ️</span> Cómo Funcionan las Comisiones
        </h3>
        <div className="space-y-3 text-sm text-stone-700">
          <div className="bg-white rounded-lg p-3">
            <p className="font-semibold text-green-700 mb-1">✓ Comisiones Netas:</p>
            <p>Se pagan a la agencia en cuanto termina el viaje.</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="font-semibold text-amber-700 mb-1">⏱ Comisiones Brutas:</p>
            <p>Normalmente tardan <span className="font-bold">2 a 3 meses</span> en ser pagadas por el proveedor después de finalizado el viaje.</p>
          </div>
          <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
            <p className="font-semibold text-blue-700 mb-1">📋 Proceso de Facturación:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Usa el <span className="font-semibold">check mark</span> para seleccionar comisiones</li>
              <li>Haz clic en <span className="font-semibold">"Generar Factura"</span> para crear tu factura</li>
              <li>Entrega la factura a <span className="font-semibold">Administración Nomad</span></li>
              <li>Administración se encarga de pagar la comisión al agente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Comisiones Totales</p>
          <p className="text-xl font-bold text-stone-700">${totalCommissionsFull.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-1">100%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Total Agente</p>
          <p className="text-xl font-bold" style={{ color: '#2E442A' }}>${agentCommissionTotal.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-1">{agentCommissionRate * 100}% del total</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Pendientes</p>
          <p className="text-xl font-bold text-orange-500">${pendingCommissions.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-1">Por confirmar</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Confirmadas por Admin</p>
          <p className="text-xl font-bold text-blue-600">${confirmedCommissions.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-1">Por pagar</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Pagadas a Agente</p>
          <p className="text-xl font-bold text-green-600">${paidCommissions.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-1">Ya cobrado</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Buscar por cliente o servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterBookedBy} onValueChange={setFilterBookedBy}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="Bookeado por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="montecito">Montecito</SelectItem>
            <SelectItem value="iata_nomad">IATA Nomad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          // La selección es por pestaña: evitar facturar servicios que ya no se ven
          setSelectedServices([]);
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="pendientes">
            Pendientes ({allFilteredServices.filter(s => !s.paid_to_agency).length})
          </TabsTrigger>
          <TabsTrigger value="confirmadas">
            Pagado a agencia ({allFilteredServices.filter(s => s.paid_to_agency && !s.paid_to_agent).length})
          </TabsTrigger>
          <TabsTrigger value="pagadas">
            Pagadas a agente ({allFilteredServices.filter(s => s.paid_to_agent).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left p-3 font-semibold text-stone-600 w-12">
                  <Checkbox
                    checked={selectedVisibleServices.length === filteredServices.length && filteredServices.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedServices(filteredServices.map(s => s.id));
                      } else {
                        setSelectedServices([]);
                      }
                    }}
                  />
                </th>
                <th className="text-left p-3 font-semibold text-stone-600 w-24">Pagada a agente</th>
                <th className="text-left p-3 font-semibold text-stone-600 w-32">Pagado a agencia</th>
                <th className="text-left p-3 font-semibold text-stone-600">Cliente</th>
                <th className="text-left p-3 font-semibold text-stone-600">Servicio</th>
                <th className="text-left p-3 font-semibold text-stone-600">Tipo</th>
                <th className="text-left p-3 font-semibold text-stone-600">Bookeado por</th>
                <th className="text-left p-3 font-semibold text-stone-600">Reservado por</th>
                <th className="text-left p-3 font-semibold text-stone-600 w-32">Fecha Estimada Pago</th>
                <th className="text-right p-3 font-semibold text-stone-600 w-32">Comisión</th>
                <th className="text-center p-3 font-semibold text-stone-600 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredServices.map((service) => {
              const trip = tripsMap[service.sold_trip_id];
              const isEditing = editingService === service.id;
              const isPaid = service.paid_to_agent || false;
              const canEdit = isAdmin || !isPaid;
              
              return (
                <tr key={service.id} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3">
                    <Checkbox
                      checked={selectedServices.includes(service.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedServices([...selectedServices, service.id]);
                        } else {
                          setSelectedServices(selectedServices.filter(id => id !== service.id));
                        }
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={isPaid ? 'yes' : 'no'}
                      onValueChange={(value) => togglePaid(service, value === 'yes')}
                    >
                      <SelectTrigger className={`h-8 w-20 text-xs ${isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-50'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Sí</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      <Select
                        value={service.paid_to_agency ? 'yes' : 'no'}
                        onValueChange={(value) => {
                          const newValue = value === 'yes';
                          updateServiceMutation.mutate({
                            id: service.id,
                            data: {
                              paid_to_agency: newValue,
                              // Comisiones Internas deriva el estado de commission_paid: mantener ambos en sincronía
                              commission_paid: newValue,
                              paid_to_agency_date: newValue ? (service.paid_to_agency_date || new Date().toISOString().split('T')[0]) : null
                            }
                          });
                        }}
                      >
                        <SelectTrigger className={`h-8 w-20 text-xs ${service.paid_to_agency ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-50'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Sí</SelectItem>
                        </SelectContent>
                      </Select>
                      {service.paid_to_agency && service.paid_to_agency_date && (
                        <p className="text-xs text-green-600 font-medium">
                          {formatDate(service.paid_to_agency_date, 'd MMM yy', { locale: es })}
                        </p>
                      )}
                    </div>
                  </td>
                    <td className="p-3">
                      <span className="font-medium text-stone-800">{trip?.client_name || '-'}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-stone-700">{getServiceName(service)}</span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {SERVICE_TYPE_LABELS[service.service_type] || service.service_type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-stone-600">
                        {BOOKED_BY_LABELS[service.booked_by || service.metadata?.booked_by] || '-'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-stone-600">
                        {RESERVED_BY_LABELS[service.reserved_by] || service.flight_consolidator || CRUISE_PROVIDER_LABELS[service.cruise_provider] || '-'}
                      </span>
                    </td>
                    <td className="p-3">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editValues.commission_payment_date || ''}
                          onChange={(e) => setEditValues({...editValues, commission_payment_date: e.target.value})}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <div className="space-y-1">
                          <span 
                            className={`text-stone-500 block ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                            onClick={() => canEdit && startEditing(service)}
                          >
                            {formatDate(service.commission_payment_date, 'd MMM yy', { locale: es })}
                          </span>
                          {service.commission_payment_date && service.payment_type === 'bruto' && (
                            <p className="text-xs text-amber-600">
                              (~2-3 meses)
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValues.commission || 0}
                          onChange={(e) => setEditValues({...editValues, commission: e.target.value})}
                          className="h-8 text-xs text-right"
                        />
                      ) : (
                        <span 
                          className={`font-semibold ${service.paid_to_agent ? 'text-green-600' : 'text-stone-800'} ${canEdit ? 'cursor-pointer hover:text-blue-600' : 'cursor-not-allowed opacity-60'}`}
                          onClick={() => canEdit && startEditing(service)}
                        >
                          ${(service.commission || 0).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveEditing(service)}
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={cancelEditing}
                            className="h-8 w-8 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(service)}
                          className="h-8 w-8 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="p-8 text-center text-stone-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <p>No hay comisiones que mostrar</p>
          </div>
        )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice Generator Dialog */}
      <AgentInvoiceGenerator
        open={invoiceDialogOpen}
        onClose={() => setInvoiceDialogOpen(false)}
        services={selectedVisibleServices}
        soldTrips={soldTrips}
        currentUser={user}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar comisión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el servicio y su comisión asociada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteServiceMutation.mutate(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}