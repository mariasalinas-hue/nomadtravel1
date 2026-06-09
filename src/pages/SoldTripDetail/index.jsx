import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Loader2, StickyNote, FolderOpen, Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Forms and Modals
import ServiceForm from '@/components/soldtrips/ServiceForm';
import PaymentForm from '@/components/soldtrips/PaymentForm';
import SupplierPaymentForm from '@/components/soldtrips/SupplierPaymentForm';
import PaymentPlanForm from '@/components/soldtrips/PaymentPlanForm';
import EditPaymentPlanItem from '@/components/soldtrips/EditPaymentPlanItem';
import InvoiceView from '@/components/soldtrips/InvoiceView';
import SoldTripForm from '@/components/soldtrips/SoldTripForm';
import TripNotesList from '@/components/soldtrips/TripNotesList';
import TripDocumentsList from '@/components/soldtrips/TripDocumentsList';
import TripRemindersList from '@/components/soldtrips/TripRemindersList';
import ActiveTripReminders from '@/components/soldtrips/ActiveTripReminders';

// Custom hooks
import { useTripData } from './hooks/useTripData';
import { useTripMutations } from './hooks/useTripMutations';
import { useTripMetrics } from './hooks/useTripMetrics';

// Components
import TripHeader from './components/TripHeader';
import FinancialSummary from './components/FinancialSummary';
import PaymentAlerts from './components/PaymentAlerts';
import ServicesTab from './components/ServicesTab';
import ClientPaymentsTab from './components/ClientPaymentsTab';
import SupplierPaymentsTab from './components/SupplierPaymentsTab';

export default function SoldTripDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');

  // State
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [clientPaymentOpen, setClientPaymentOpen] = useState(false);
  const [editingClientPayment, setEditingClientPayment] = useState(null);
  const [supplierPaymentOpen, setSupplierPaymentOpen] = useState(false);
  const [editingSupplierPayment, setEditingSupplierPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('services');
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [editingPlanItem, setEditingPlanItem] = useState(null);
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [currentExchangeRates, setCurrentExchangeRates] = useState({});

  // Data fetching
  const {
    soldTrip,
    tripLoading,
    services,
    clientPayments,
    supplierPayments,
    paymentPlan,
    tripNotes,
    tripDocuments,
    tripReminders
  } = useTripData(tripId);

  // Mutations
  const mutations = useTripMutations(tripId, services, clientPayments, supplierPayments);

  // Metrics
  const metrics = useTripMetrics(soldTrip, services, clientPayments, supplierPayments);

  // Fetch exchange rates
  useEffect(() => {
    const fetchExchangeRates = async () => {
      const uniqueCurrencies = [...new Set(
        services
          .filter(s => s.local_currency && s.local_currency !== 'USD' && s.quote_date)
          .map(s => s.local_currency)
      )];

      if (uniqueCurrencies.length === 0) return;

      const rates = {};
      for (const currency of uniqueCurrencies) {
        try {
          const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
          const data = await response.json();
          rates[currency] = data.rates.USD;
        } catch (error) {
          console.error(`Error fetching rate for ${currency}:`, error);
        }
      }
      setCurrentExchangeRates(rates);
    };

    fetchExchangeRates();
  }, [services]);

  // Handlers
  const handleSaveService = (data) => {
    const onSuccess = () => { setServiceFormOpen(false); setEditingService(null); };
    if (editingService) {
      mutations.updateServiceMutation.mutate({ id: editingService.id, data }, { onSuccess });
    } else {
      mutations.createServiceMutation.mutate(data, { onSuccess });
    }
  };

  const handleAddService = () => {
    setEditingService(null);
    setServiceFormOpen(true);
  };

  const handleEditService = (service) => {
    setEditingService(service);
    setServiceFormOpen(true);
  };

  const handleDeleteService = (service) => {
    setDeleteConfirm({ type: 'service', item: service, sold_trip_id: service.sold_trip_id });
  };

  const handleUpdateServiceStatus = (serviceId, status) => {
    // Update in both direct field and metadata to ensure compatibility
    const service = services.find(s => s.id === serviceId);
    const updatedMetadata = {
      ...(service?.metadata || {}),
      reservation_status: status
    };
    mutations.updateServiceMutation.mutate({
      id: serviceId,
      data: {
        reservation_status: status,
        metadata: updatedMetadata
      }
    });
  };

  const handleEditClientPayment = (payment) => {
    setEditingClientPayment(payment);
    setClientPaymentOpen(true);
  };

  const handleDeleteClientPayment = (payment) => {
    setDeleteConfirm({ type: 'client', item: payment, sold_trip_id: payment.sold_trip_id });
  };

  const handleEditSupplierPayment = (payment) => {
    setEditingSupplierPayment(payment);
    setSupplierPaymentOpen(true);
  };

  const handleDeleteSupplierPayment = (payment) => {
    setDeleteConfirm({ type: 'supplier', item: payment, sold_trip_id: payment.sold_trip_id, payment });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.type === 'service') {
      mutations.deleteServiceMutation.mutate({
        id: deleteConfirm.item.id,
        sold_trip_id: deleteConfirm.sold_trip_id
      });
    } else {
      mutations.deletePaymentMutation.mutate({
        type: deleteConfirm.type,
        id: deleteConfirm.item.id,
        sold_trip_id: deleteConfirm.sold_trip_id,
        payment: deleteConfirm.payment
      });
    }
  };

  // Loading state
  if (tripLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  // Not found
  if (!soldTrip) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Viaje no encontrado</p>
        <Link to={createPageUrl('SoldTrips')}>
          <Button variant="link" style={{ color: '#2E442A' }}>Volver a viajes vendidos</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4 max-w-[1600px] mx-auto px-2 md:px-0">
      {/* Header */}
      <TripHeader
        soldTrip={soldTrip}
        paymentPlan={paymentPlan}
        daysUntilTrip={metrics.daysUntilTrip}
        isTripPast={metrics.isTripPast}
        onEditTrip={() => setEditTripOpen(true)}
        onCreatePaymentPlan={() => setPaymentPlanOpen(true)}
        onOpenInvoice={() => setInvoiceOpen(true)}
        onUpdateStatus={(status) => mutations.updateTripMutation.mutate({ status })}
      />

      {/* Financial Summary */}
      <FinancialSummary metrics={metrics} />

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <PaymentAlerts alerts={metrics.pendingPaymentAlerts} />
        <ActiveTripReminders
          startDate={soldTrip.start_date}
          reminders={tripReminders}
          onUpdate={(id, data) => mutations.updateReminderMutation.mutate({ id, data })}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 md:space-y-4">
        <TabsList className="bg-gradient-to-r from-stone-100 to-stone-200 p-1 md:p-1.5 rounded-xl md:rounded-2xl flex-wrap shadow-sm gap-1 md:gap-0">
          <TabsTrigger value="services" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <span className="hidden sm:inline">Servicios</span>
            <span className="sm:hidden">Srv</span>
            <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{services.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="client-payments" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <span className="hidden sm:inline">Pagos Cliente</span>
            <span className="sm:hidden">Cliente</span>
            <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{clientPayments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="supplier-payments" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <span className="hidden sm:inline">Pagos Proveedores</span>
            <span className="sm:hidden">Prov</span>
            <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{supplierPayments.length}</Badge>
          </TabsTrigger>
          {paymentPlan.length > 0 && (
            <TabsTrigger value="payment-plan" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
              <span className="hidden sm:inline">Plan de Pagos</span>
              <span className="sm:hidden">Plan</span>
              <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{paymentPlan.length}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="notes" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <StickyNote className="w-3 h-3 md:w-4 md:h-4 md:mr-1.5" />
            <span className="hidden md:inline">Notas</span>
            <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{tripNotes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <FolderOpen className="w-3 h-3 md:w-4 md:h-4 md:mr-1.5" />
            <span className="hidden md:inline">Docs</span>
            <Badge variant="secondary" className="ml-1 md:ml-2 text-xs bg-stone-200 px-1">{tripDocuments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reminders" className="rounded-lg md:rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2">
            <Bell className="w-3 h-3 md:w-4 md:h-4 md:mr-1.5" />
            <span className="hidden md:inline">Recordatorios</span>
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services">
          <ServicesTab
            services={services}
            servicesByType={metrics.servicesByType}
            supplierPayments={supplierPayments}
            currentExchangeRates={currentExchangeRates}
            totalServices={metrics.totalServices}
            totalCommissions={metrics.totalCommissions}
            onAddService={handleAddService}
            onEditService={handleEditService}
            onDeleteService={handleDeleteService}
            onUpdateServiceStatus={handleUpdateServiceStatus}
          />
        </TabsContent>

        {/* Client Payments Tab */}
        <TabsContent value="client-payments">
          <ClientPaymentsTab
            clientPayments={clientPayments}
            totalClientPaid={metrics.totalClientPaid}
            totalServices={metrics.totalServices}
            onAddPayment={() => setClientPaymentOpen(true)}
            onEditPayment={handleEditClientPayment}
            onDeletePayment={handleDeleteClientPayment}
          />
        </TabsContent>

        {/* Supplier Payments Tab */}
        <TabsContent value="supplier-payments">
          <SupplierPaymentsTab
            supplierPayments={supplierPayments}
            totalSupplierPaid={metrics.totalSupplierPaid}
            onAddPayment={() => setSupplierPaymentOpen(true)}
            onEditPayment={handleEditSupplierPayment}
            onDeletePayment={handleDeleteSupplierPayment}
          />
        </TabsContent>

        {/* Payment Plan Tab */}
        {paymentPlan.length > 0 && (
          <TabsContent value="payment-plan">
            <div className="bg-white rounded-2xl shadow-md border border-stone-100 p-6">
              <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: '#2E442A' }} />
                Plan de Pagos
              </h3>
              <div className="space-y-3">
                {paymentPlan.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border-2 border-stone-200 rounded-xl bg-stone-50 hover:bg-stone-100 hover:border-stone-300 transition-all">
                    <div>
                      <p className="font-semibold text-stone-800">{item.description}</p>
                      <p className="text-sm text-stone-600">Vencimiento: {new Date(item.due_date).toLocaleDateString('es-ES', { dateStyle: 'long' })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-emerald-600">${(item.amount || 0).toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPlanItem(item)}
                        className="hover:bg-blue-50 hover:text-blue-600"
                      >
                        <StickyNote className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Notes Tab */}
        <TabsContent value="notes">
          <div className="bg-white rounded-2xl shadow-md border border-stone-100 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <StickyNote className="w-5 h-5" style={{ color: '#2E442A' }} />
              Notas y Pendientes del Viaje
            </h3>
            <TripNotesList
              notes={tripNotes}
              onCreate={(data) => mutations.createNoteMutation.mutate(data)}
              onUpdate={(id, data) => mutations.updateNoteMutation.mutate({ id, data })}
              onDelete={(id) => mutations.deleteNoteMutation.mutate(id)}
              isLoading={mutations.createNoteMutation.isPending}
            />
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="bg-white rounded-2xl shadow-md border border-stone-100 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5" style={{ color: '#2E442A' }} />
              Documentos del Viaje
            </h3>
            <TripDocumentsList
              documents={tripDocuments}
              soldTripId={tripId}
              onCreate={(data) => mutations.createDocumentMutation.mutate(data)}
              onDelete={(id) => mutations.deleteDocumentMutation.mutate(id)}
              isLoading={mutations.createDocumentMutation.isPending}
            />
          </div>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders">
          <div className="bg-white rounded-2xl shadow-md border border-stone-100 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" style={{ color: '#2E442A' }} />
              Timeline de Recordatorios para el Cliente
            </h3>
            <TripRemindersList
              startDate={soldTrip.start_date}
              reminders={tripReminders}
              onCreate={(reminders) => mutations.createRemindersMutation.mutate(reminders)}
              onUpdate={(id, data) => mutations.updateReminderMutation.mutate({ id, data })}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ServiceForm
        open={serviceFormOpen}
        onClose={() => { setServiceFormOpen(false); setEditingService(null); }}
        service={editingService}
        soldTripId={tripId}
        onSave={handleSaveService}
        isLoading={mutations.createServiceMutation.isPending || mutations.updateServiceMutation.isPending}
      />

      <PaymentForm
        open={clientPaymentOpen}
        onClose={() => { setClientPaymentOpen(false); setEditingClientPayment(null); }}
        soldTripId={tripId}
        payment={editingClientPayment}
        type="client"
        onSave={(data) => {
          if (editingClientPayment) {
            mutations.updateClientPaymentMutation.mutate(
              { id: editingClientPayment.id, data },
              {
                onSuccess: () => {
                  setClientPaymentOpen(false);
                  setEditingClientPayment(null);
                }
              }
            );
          } else {
            mutations.createClientPaymentMutation.mutate(data, {
              onSuccess: () => {
                setClientPaymentOpen(false);
                setEditingClientPayment(null);
              }
            });
          }
        }}
        isLoading={mutations.createClientPaymentMutation.isPending || mutations.updateClientPaymentMutation.isPending}
      />

      <SupplierPaymentForm
        open={supplierPaymentOpen}
        onClose={() => { setSupplierPaymentOpen(false); setEditingSupplierPayment(null); }}
        soldTripId={tripId}
        services={services}
        supplierPayments={supplierPayments}
        payment={editingSupplierPayment}
        onSave={(data) => {
          if (editingSupplierPayment) {
            mutations.updateSupplierPaymentMutation.mutate(
              {
                id: editingSupplierPayment.id,
                data,
                oldPayment: editingSupplierPayment
              },
              {
                onSuccess: () => {
                  setSupplierPaymentOpen(false);
                  setEditingSupplierPayment(null);
                }
              }
            );
          } else {
            mutations.createSupplierPaymentMutation.mutate(data, {
              onSuccess: () => {
                setSupplierPaymentOpen(false);
                setEditingSupplierPayment(null);
              }
            });
          }
        }}
        isLoading={mutations.createSupplierPaymentMutation.isPending || mutations.updateSupplierPaymentMutation.isPending}
      />

      <PaymentPlanForm
        open={paymentPlanOpen}
        onClose={() => setPaymentPlanOpen(false)}
        soldTripId={tripId}
        soldTrip={soldTrip}
        totalAmount={metrics.totalServices}
        onSave={(payments) => mutations.createPaymentPlanMutation.mutate(payments)}
        isLoading={mutations.createPaymentPlanMutation.isPending}
      />

      <EditPaymentPlanItem
        open={!!editingPlanItem}
        onClose={() => setEditingPlanItem(null)}
        planItem={editingPlanItem}
        onSave={(data) => mutations.updatePaymentPlanItemMutation.mutate({ id: editingPlanItem.id, data })}
        isLoading={mutations.updatePaymentPlanItemMutation.isPending}
      />

      <InvoiceView
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        soldTrip={soldTrip}
        services={services}
        clientPayments={clientPayments}
      />

      <SoldTripForm
        open={editTripOpen}
        onClose={() => setEditTripOpen(false)}
        soldTrip={soldTrip}
        onSave={(data) => mutations.updateTripMutation.mutate(data)}
        isLoading={mutations.updateTripMutation.isPending}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
