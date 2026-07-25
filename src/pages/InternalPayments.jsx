import React, { useState, useMemo, memo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Loader2, Search, CreditCard, Calendar, ArrowUpDown, Users, Clock, CheckCircle, Edit2, Trash2,
  DollarSign, TrendingUp, X, Filter
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import EmptyState from '@/components/ui/EmptyState';
import { toast } from "sonner";
import { updateSoldTripAndTripServiceTotals } from '@/components/utils/soldTripRecalculations';
import { PAYMENT_METHOD_LABELS, SUPPLIER_PAYMENT_METHODS } from '@/config/paymentMethods';

// Loading Skeleton
const TableSkeleton = memo(() => (
  <div className="space-y-3 p-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex gap-4 animate-pulse">
        <div className="h-14 bg-stone-200 rounded-xl flex-1"></div>
        <div className="h-14 bg-stone-200 rounded-xl w-32"></div>
        <div className="h-14 bg-stone-200 rounded-xl w-24"></div>
      </div>
    ))}
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

// Modern Stats Card Component
const StatsCard = memo(({ title, value, subtitle, icon: Icon, gradient, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay: index * 0.05, duration: 0.3, type: "spring" }}
    whileHover={{ y: -5, scale: 1.02 }}
  >
    <Card className={`relative overflow-hidden group cursor-pointer bg-gradient-to-br ${gradient} p-3 md:p-4 shadow-lg hover:shadow-2xl transition-all duration-300 min-h-[90px] md:min-h-[110px]`}>
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] md:text-xs font-bold text-white/90 uppercase tracking-wide line-clamp-1">{title}</p>
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-7 h-7 md:w-8 md:h-8 bg-white/20 rounded-lg flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0"
          >
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </motion.div>
        </div>
        <p className="text-base md:text-lg lg:text-xl font-black text-white mb-1 break-all leading-none">{value}</p>
        {subtitle && <p className="text-[10px] md:text-xs text-white/80 font-semibold line-clamp-1 mt-auto">{subtitle}</p>}
      </div>
    </Card>
  </motion.div>
));

StatsCard.displayName = 'StatsCard';

export default function InternalPayments() {
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeTab, setActiveTab] = useState('pending');
  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const queryClient = useQueryClient();

  const { data: supplierPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['allSupplierPayments'],
    queryFn: () => supabaseAPI.entities.SupplierPayment.list('-date')
  });

  const { data: soldTrips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ['soldTrips'],
    queryFn: () => supabaseAPI.entities.SoldTrip.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => supabaseAPI.entities.User.list()
  });

  const isLoading = loadingPayments || loadingTrips;

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.SupplierPayment.update(id, data),
    onSuccess: async (_, variables) => {
      const payment = supplierPayments.find(p => p.id === variables.id);
      if (payment?.sold_trip_id) {
        await updateSoldTripAndTripServiceTotals(payment.sold_trip_id, queryClient);
      }
      await queryClient.invalidateQueries({ queryKey: ['allSupplierPayments'] });
      setEditingPayment(null);
      toast.success('Pago actualizado correctamente');
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: ({ id, sold_trip_id }) => supabaseAPI.entities.SupplierPayment.delete(id),
    onSuccess: async (_, variables) => {
      if (variables.sold_trip_id) {
        await updateSoldTripAndTripServiceTotals(variables.sold_trip_id, queryClient);
      }
      await queryClient.invalidateQueries({ queryKey: ['allSupplierPayments'] });
      setDeleteConfirm(null);
      toast.success('Pago eliminado correctamente');
    }
  });

  // Create trips map for quick lookup
  const tripsMap = useMemo(() => soldTrips.reduce((acc, trip) => {
    acc[trip.id] = trip;
    return acc;
  }, {}), [soldTrips]);

  // Enrich payments with trip and agent info
  const enrichedPayments = useMemo(() =>
    supplierPayments
      .filter(payment => payment.method !== 'tarjeta_cliente')
      .map(payment => {
        const trip = tripsMap[payment.sold_trip_id];
        const agentEmail = trip?.created_by || '';
        const agent = users.find(u => u.email === agentEmail);

        return {
          ...payment,
          trip_name: trip ? `${trip.client_name} - ${trip.destination}` : 'Viaje',
          agent_name: agent?.full_name || agentEmail || 'Sin asignar',
          agent_email: agentEmail
        };
      }),
    [supplierPayments, tripsMap, users]
  );

  // Get unique agents and methods
  const uniqueAgents = useMemo(() =>
    [...new Set(enrichedPayments.map(p => p.agent_name))].filter(Boolean),
    [enrichedPayments]
  );

  const uniqueMethods = useMemo(() =>
    [...new Set(supplierPayments.map(p => p.method))].filter(Boolean),
    [supplierPayments]
  );

  // Filter and sort payments
  const filteredPayments = useMemo(() =>
    enrichedPayments
      .filter(p => {
        const matchesSearch =
          (p.supplier || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.trip_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (p.agent_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesAgent = filterAgent === 'all' || p.agent_name === filterAgent;
        const matchesMethod = filterMethod === 'all' || p.method === filterMethod;

        const paymentDate = p.date ? new Date(p.date) : null;
        const matchesDateFrom = !dateFrom || (paymentDate && paymentDate >= new Date(dateFrom));
        const matchesDateTo = !dateTo || (paymentDate && paymentDate <= new Date(dateTo));

        return matchesSearch && matchesAgent && matchesMethod && matchesDateFrom && matchesDateTo;
      })
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }),
    [enrichedPayments, search, filterAgent, filterMethod, dateFrom, dateTo, sortOrder]
  );

  // Split by status
  const pendingPayments = useMemo(() => filteredPayments.filter(p => !p.confirmed && !p.paid), [filteredPayments]);
  const confirmedPayments = useMemo(() => filteredPayments.filter(p => p.confirmed && !p.paid), [filteredPayments]);
  const paidPayments = useMemo(() => filteredPayments.filter(p => p.paid), [filteredPayments]);

  // Calculate totals
  const totalPending = useMemo(() => pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0), [pendingPayments]);
  const totalConfirmed = useMemo(() => confirmedPayments.reduce((sum, p) => sum + (p.amount || 0), 0), [confirmedPayments]);
  const totalPaid = useMemo(() => paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0), [paidPayments]);

  const handleStatusChange = (payment, status) => {
    const updates = {
      confirmed: status === 'confirmed' || status === 'paid',
      paid: status === 'paid'
    };
    updatePaymentMutation.mutate({ id: payment.id, data: updates });
  };

  const hasActiveFilters = search || filterAgent !== 'all' || filterMethod !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setFilterAgent('all');
    setFilterMethod('all');
    setDateFrom('');
    setDateTo('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-stone-200 rounded-lg w-64 animate-pulse"></div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-stone-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="bg-white rounded-xl overflow-hidden">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-stone-900">Pagos Internos</h1>
        <p className="text-sm md:text-base text-stone-500 mt-1">
          Registro completo de pagos a proveedores • {filteredPayments.length} pago{filteredPayments.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtrados)'}
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatsCard
          title="Pagos Hechos"
          value={`$${totalPending.toLocaleString()}`}
          subtitle={`${pendingPayments.length} pago${pendingPayments.length !== 1 ? 's' : ''}`}
          icon={Clock}
          gradient="from-orange-500 via-orange-600 to-red-500"
          index={0}
        />
        <StatsCard
          title="Confirmados"
          value={`$${totalConfirmed.toLocaleString()}`}
          subtitle={`${confirmedPayments.length} pago${confirmedPayments.length !== 1 ? 's' : ''}`}
          icon={CheckCircle}
          gradient="from-blue-500 via-blue-600 to-indigo-600"
          index={1}
        />
        <StatsCard
          title="Pagado"
          value={`$${totalPaid.toLocaleString()}`}
          subtitle={`${paidPayments.length} pago${paidPayments.length !== 1 ? 's' : ''}`}
          icon={CheckCircle}
          gradient="from-emerald-500 via-green-600 to-teal-600"
          index={2}
        />
        <StatsCard
          title="Total Pagos"
          value={`$${(totalPending + totalConfirmed + totalPaid).toLocaleString()}`}
          subtitle="Suma total"
          icon={DollarSign}
          gradient="from-slate-700 via-slate-800 to-slate-900"
          index={3}
        />
        <StatsCard
          title="Agentes"
          value={uniqueAgents.length}
          subtitle="Agentes activos"
          icon={Users}
          gradient="from-purple-500 via-purple-600 to-indigo-600"
          index={4}
        />
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-5 bg-gradient-to-br from-stone-50 to-white border border-stone-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-stone-500" />
          <h3 className="font-bold text-stone-900">Filtros</h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto text-xs h-7 rounded-lg"
            >
              <X className="w-3 h-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Buscar por proveedor, viaje o agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="w-full md:w-48 rounded-xl">
              <SelectValue placeholder="Todos los agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {uniqueAgents.map(agent => (
                <SelectItem key={agent} value={agent}>{agent}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-full md:w-52 rounded-xl">
              <SelectValue placeholder="Todos los métodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              {uniqueMethods.map(method => (
                <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method] || method}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full md:w-40 rounded-xl"
              placeholder="Desde"
            />
            <span className="text-stone-400">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full md:w-40 rounded-xl"
              placeholder="Hasta"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="rounded-xl w-full md:w-auto"
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {sortOrder === 'asc' ? 'Más antiguas' : 'Más recientes'}
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gradient-to-r from-stone-100 to-stone-50 rounded-xl p-1 w-full md:w-auto">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md flex-1 md:flex-initial">
            <Clock className="w-4 h-4 mr-2" /> Hechos ({pendingPayments.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md flex-1 md:flex-initial">
            <CheckCircle className="w-4 h-4 mr-2" /> Confirmados ({confirmedPayments.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md flex-1 md:flex-initial">
            <TrendingUp className="w-4 h-4 mr-2" /> Pagados ({paidPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderPaymentsTable(pendingPayments, totalPending, 'pending')}
        </TabsContent>

        <TabsContent value="confirmed" className="mt-4">
          {renderPaymentsTable(confirmedPayments, totalConfirmed, 'confirmed')}
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          {renderPaymentsTable(paidPayments, totalPaid, 'paid')}
        </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={() => setEditingPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Pago a Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Input
                value={editFormData.supplier || ''}
                onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={editFormData.date || ''}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                value={editFormData.amount || ''}
                onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Pago</Label>
              <Select
                value={editFormData.payment_type || 'neto'}
                onValueChange={(value) => setEditFormData({ ...editFormData, payment_type: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neto">Neto</SelectItem>
                  <SelectItem value="bruto">Bruto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select
                value={editFormData.method || ''}
                onValueChange={(value) => setEditFormData({ ...editFormData, method: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={editFormData.notes || ''}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingPayment(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => updatePaymentMutation.mutate({ id: editingPayment.id, data: editFormData })}
              disabled={updatePaymentMutation.isPending}
              className="rounded-xl text-white bg-emerald-600 hover:bg-emerald-700"
            >
              {updatePaymentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el pago de <strong>${deleteConfirm?.amount?.toLocaleString()}</strong> a <strong>{deleteConfirm?.supplier}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePaymentMutation.mutate({ id: deleteConfirm.id, sold_trip_id: deleteConfirm.sold_trip_id })}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              Eliminar Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderPaymentsTable(payments, total, tabType) {
    if (payments.length === 0) {
      const emptyMessages = {
        pending: { title: "Sin pagos hechos", description: "No hay pagos pendientes de confirmar" },
        confirmed: { title: "Sin pagos confirmados", description: "No hay pagos confirmados aún" },
        paid: { title: "Sin pagos pagados", description: "No hay pagos pagados aún" }
      };
      const message = emptyMessages[tabType] || emptyMessages.pending;
      return (
        <EmptyState
          icon={CreditCard}
          title={message.title}
          description={message.description}
        />
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-stone-50 to-stone-100 border-b-2 border-stone-200">
              <tr>
                <th className="text-left p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Fecha</th>
                <th className="text-left p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Agente</th>
                <th className="text-left p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Viaje</th>
                <th className="text-left p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Proveedor</th>
                <th className="text-left p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Método</th>
                <th className="text-right p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Monto</th>
                <th className="text-center p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Estatus</th>
                <th className="text-center p-4 font-bold text-stone-700 text-xs uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((payment, idx) => (
                <motion.tr
                  key={payment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                  className="hover:bg-gradient-to-r hover:from-stone-50 hover:to-transparent transition-all group"
                >
                  <td className="p-4">
                    <span className="font-semibold text-stone-800">
                      {formatDate(payment.date, 'd MMM yyyy', { locale: es })}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-100 shadow-sm">
                        <Users className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-stone-700 font-medium">{payment.agent_name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-stone-700">{payment.trip_name}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-stone-800">{payment.supplier || '-'}</span>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                      {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-base font-bold text-emerald-600">
                      ${(payment.amount || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Select
                      value={payment.paid ? 'paid' : (payment.confirmed ? 'confirmed' : 'pending')}
                      onValueChange={(value) => handleStatusChange(payment, value)}
                    >
                      <SelectTrigger className="w-36 h-9 text-xs rounded-lg border-2 shadow-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Hecho</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="paid">Pagado</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => {
                          setEditingPayment(payment);
                          setEditFormData({
                            supplier: payment.supplier,
                            date: payment.date,
                            amount: payment.amount,
                            method: payment.method,
                            payment_type: payment.payment_type || 'neto',
                            notes: payment.notes || ''
                          });
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteConfirm(payment)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot className="bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-200">
              <tr>
                <td colSpan="5" className="p-4 text-right font-bold text-stone-700 text-sm uppercase tracking-wide">
                  Total:
                </td>
                <td className="p-4 text-right">
                  <span className="text-2xl font-black text-emerald-700">
                    ${total.toLocaleString()}
                  </span>
                </td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
}
