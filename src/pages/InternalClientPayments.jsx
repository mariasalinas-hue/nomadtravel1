import React, { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { 
  Loader2, Search, CreditCard, Calendar, ArrowUpDown, Users, Clock, CheckCircle, Edit2, Trash2
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { updateSoldTripAndPaymentPlanTotals } from '@/components/utils/soldTripRecalculations';
import { PAYMENT_METHOD_LABELS, CLIENT_PAYMENT_METHODS } from '@/config/paymentMethods';

export default function InternalClientPayments() {
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeTab, setActiveTab] = useState('reportado');
  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const queryClient = useQueryClient();

  const { data: clientPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['allClientPayments'],
    queryFn: () => supabaseAPI.entities.ClientPayment.list('-date')
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
    mutationFn: ({ id, data }) => supabaseAPI.entities.ClientPayment.update(id, data),
    onSuccess: async (_, variables) => {
      // Obtener el pago actualizado para recalcular
      const payment = clientPayments.find(p => p.id === variables.id);
      if (payment?.sold_trip_id) {
        await updateSoldTripAndPaymentPlanTotals(payment.sold_trip_id, queryClient);
      }
      await queryClient.invalidateQueries({ queryKey: ['allClientPayments'] });
      setEditingPayment(null);
      toast.success('Pago actualizado');
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: ({ id, sold_trip_id }) => supabaseAPI.entities.ClientPayment.delete(id),
    onSuccess: async (_, variables) => {
      if (variables.sold_trip_id) {
        await updateSoldTripAndPaymentPlanTotals(variables.sold_trip_id, queryClient);
      }
      await queryClient.invalidateQueries({ queryKey: ['allClientPayments'] });
      setDeleteConfirm(null);
      toast.success('Pago eliminado');
    }
  });

  // Create trips map for quick lookup
  const tripsMap = soldTrips.reduce((acc, trip) => {
    acc[trip.id] = trip;
    return acc;
  }, {});

  // Enrich payments with trip and agent info and filter out "tarjeta_cliente"
  const enrichedPayments = clientPayments
    .filter(payment => payment.method !== 'tarjeta_cliente')
    .map(payment => {
      const trip = tripsMap[payment.sold_trip_id];
      // Try payment's created_by first, then fallback to trip's created_by
      const agentEmail = payment.created_by || trip?.created_by || '';
      const agent = users.find(u => u.email === agentEmail);
      
      // Determine agent display name
      let displayAgentName = 'Sin asignar';
      if (agent?.full_name) {
        displayAgentName = agent.full_name;
      } else if (agentEmail && (agentEmail.includes('no-reply.base44.com') || agentEmail.includes('service+'))) {
        displayAgentName = 'Sistema Automático';
      } else if (agentEmail) {
        displayAgentName = agentEmail;
      }
      
      return {
        ...payment,
        client_name: trip?.client_name || 'Cliente Desconocido',
        trip_destination: trip?.destination || '',
        trip_name: trip ? `${trip.client_name} - ${trip.destination}` : 'Viaje Desconocido',
        agent_name: displayAgentName,
        agent_email: agentEmail,
        status: payment.status || (payment.confirmed ? 'confirmado' : 'reportado'),
        confirmed: payment.confirmed || false
      };
    });

  // Get unique agents
  const uniqueAgents = [...new Set(enrichedPayments.map(p => p.agent_name))].filter(Boolean);

  // Get unique payment methods
  const uniqueMethods = [...new Set(clientPayments.map(p => p.method))].filter(Boolean);

  // Filter and sort payments
  const filteredPayments = enrichedPayments
    .filter(p => {
      const matchesSearch = 
        (p.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.trip_destination || '').toLowerCase().includes(search.toLowerCase()) ||
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
    });

  // Split by status
  const reportadoPayments = filteredPayments.filter(p => p.status === 'reportado');
  const confirmadoPayments = filteredPayments.filter(p => p.status === 'confirmado');
  const cambiadoUsdPayments = filteredPayments.filter(p => p.status === 'cambiado_usd');

  // Calculate totals - include both USD and MXN amounts
  const calculateTotal = (payments) => {
    return payments.reduce((sum, p) => {
      const amountUSD = p.amount_usd_fixed || p.amount || 0;
      const amountMXN = (p.currency === 'MXN' && p.amount_original) ? p.amount_original : 0;
      return {
        usd: sum.usd + amountUSD,
        mxn: sum.mxn + amountMXN
      };
    }, { usd: 0, mxn: 0 });
  };

  const totalReportado = calculateTotal(reportadoPayments);
  const totalConfirmado = calculateTotal(confirmadoPayments);
  const totalCambiadoUsd = calculateTotal(cambiadoUsdPayments);
  const totalAll = calculateTotal(filteredPayments);

  const handleUpdateStatus = (payment, newStatus) => {
    updatePaymentMutation.mutate({ 
      id: payment.id, 
      data: { 
        status: newStatus,
        confirmed: newStatus === 'confirmado' || newStatus === 'cambiado_usd' // backward compatibility
      } 
    });
  };

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
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Pagos Internos Clientes</h1>
        <p className="text-stone-500 text-sm mt-1">Registro de depósitos de clientes por todos los agentes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Pagos Reportados</p>
          <p className="text-xl font-bold text-orange-600">
            ${totalReportado.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {totalReportado.mxn > 0 && (
            <p className="text-xs text-blue-600">${totalReportado.mxn.toLocaleString()} MXN</p>
          )}
          <p className="text-xs text-stone-400">{reportadoPayments.length} pagos</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Pagos Confirmados</p>
          <p className="text-xl font-bold text-green-600">
            ${totalConfirmado.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {totalConfirmado.mxn > 0 && (
            <p className="text-xs text-blue-600">${totalConfirmado.mxn.toLocaleString()} MXN</p>
          )}
          <p className="text-xs text-stone-400">{confirmadoPayments.length} pagos</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Pagos Cambiados a USD</p>
          <p className="text-xl font-bold text-purple-600">
            ${totalCambiadoUsd.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {totalCambiadoUsd.mxn > 0 && (
            <p className="text-xs text-blue-600">${totalCambiadoUsd.mxn.toLocaleString()} MXN</p>
          )}
          <p className="text-xs text-stone-400">{cambiadoUsdPayments.length} pagos</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
          <p className="text-xs text-stone-400">Total General</p>
          <p className="text-xl font-bold" style={{ color: '#2E442A' }}>
            ${totalAll.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {totalAll.mxn > 0 && (
            <p className="text-xs text-blue-600">${totalAll.mxn.toLocaleString()} MXN</p>
          )}
          <p className="text-xs text-stone-400">{enrichedPayments.length} pagos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Buscar por cliente, viaje o agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {uniqueAgents.map(agent => (
              <SelectItem key={agent} value={agent}>{agent}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {uniqueMethods.map(method => (
              <SelectItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method] || method}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 rounded-xl"
          />
          <span className="text-stone-400">-</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 rounded-xl"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="rounded-xl"
        >
          <ArrowUpDown className="w-4 h-4 mr-2" />
          {sortOrder === 'asc' ? 'Más antiguas' : 'Más recientes'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-stone-100 rounded-xl p-1">
          <TabsTrigger value="reportado" className="rounded-lg data-[state=active]:bg-white">
            <Clock className="w-4 h-4 mr-2" /> Reportados ({reportadoPayments.length})
          </TabsTrigger>
          <TabsTrigger value="confirmado" className="rounded-lg data-[state=active]:bg-white">
            <CheckCircle className="w-4 h-4 mr-2" /> Confirmados ({confirmadoPayments.length})
          </TabsTrigger>
          <TabsTrigger value="cambiado_usd" className="rounded-lg data-[state=active]:bg-white">
            <CreditCard className="w-4 h-4 mr-2" /> Cambiados a USD ({cambiadoUsdPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reportado" className="mt-4">
          {renderPaymentsTable(reportadoPayments, totalReportado)}
        </TabsContent>

        <TabsContent value="confirmado" className="mt-4">
          {renderPaymentsTable(confirmadoPayments, totalConfirmado)}
        </TabsContent>

        <TabsContent value="cambiado_usd" className="mt-4">
          {renderPaymentsTable(cambiadoUsdPayments, totalCambiadoUsd)}
        </TabsContent>
      </Tabs>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={() => setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pago de Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label>Moneda *</Label>
              <Select
                value={editFormData.currency || 'USD'}
                onValueChange={(value) => setEditFormData({ ...editFormData, currency: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto en {editFormData.currency || 'USD'} *</Label>
              <Input
                type="number"
                step="0.01"
                value={editFormData.amount_original || editFormData.amount || ''}
                onChange={(e) => setEditFormData({ ...editFormData, amount_original: parseFloat(e.target.value) })}
                className="rounded-xl"
              />
            </div>
            {editFormData.currency === 'MXN' && (
              <div className="space-y-2">
                <Label>Tipo de Cambio (USD/MXN) *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={editFormData.fx_rate || ''}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    const amountOriginal = editFormData.amount_original || 0;
                    const amountUSD = amountOriginal / rate;
                    setEditFormData({ 
                      ...editFormData, 
                      fx_rate: rate,
                      amount_usd_fixed: amountUSD,
                      amount: amountUSD // backward compatibility
                    });
                  }}
                  className="rounded-xl"
                  placeholder="Ej: 17.87"
                />
                {editFormData.fx_rate && editFormData.amount_original && (
                  <p className="text-xs text-stone-500">
                    ≈ ${(editFormData.amount_original / editFormData.fx_rate).toFixed(2)} USD
                  </p>
                )}
              </div>
            )}
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
                  {CLIENT_PAYMENT_METHODS.map(m => (
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
              onClick={() => {
                const dataToSave = { ...editFormData };
                // If USD, set amount_usd_fixed = amount_original
                if (dataToSave.currency === 'USD') {
                  dataToSave.amount_usd_fixed = dataToSave.amount_original;
                  dataToSave.amount = dataToSave.amount_original;
                  dataToSave.fx_rate = null;
                }
                updatePaymentMutation.mutate({ id: editingPayment.id, data: dataToSave });
              }}
              disabled={updatePaymentMutation.isPending}
              className="rounded-xl text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {updatePaymentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
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
              Esta acción no se puede deshacer. Se eliminará el pago de <strong>${(deleteConfirm?.amount_usd_fixed || deleteConfirm?.amount || 0).toLocaleString()}</strong> del cliente <strong>{deleteConfirm?.client_name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePaymentMutation.mutate({ id: deleteConfirm.id, sold_trip_id: deleteConfirm.sold_trip_id })}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  function renderPaymentsTable(payments, total) {
    if (payments.length === 0) {
      return (
        <EmptyState
          icon={CreditCard}
          title="Sin pagos en esta categoría"
          description="No hay pagos con este estatus"
        />
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left p-3 font-semibold text-stone-600">Fecha</th>
                <th className="text-left p-3 font-semibold text-stone-600">Agente</th>
                <th className="text-left p-3 font-semibold text-stone-600">Cliente</th>
                <th className="text-left p-3 font-semibold text-stone-600">Viaje</th>
                <th className="text-left p-3 font-semibold text-stone-600">Método</th>
                <th className="text-right p-3 font-semibold text-stone-600">Monto</th>
                <th className="text-center p-3 font-semibold text-stone-600">Estatus</th>
                <th className="text-center p-3 font-semibold text-stone-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-stone-50 transition-colors">
                  <td className="p-3">
                    <span className="font-medium text-stone-800">
                      {formatDate(payment.date, 'd MMM yyyy', { locale: es })}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2E442A15' }}>
                        <Users className="w-3.5 h-3.5" style={{ color: '#2E442A' }} />
                      </div>
                      <span className="text-stone-700">{payment.agent_name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-stone-800">{payment.client_name || '-'}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-stone-700">{payment.trip_destination || '-'}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">
                      {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-semibold text-green-600">
                      ${(payment.amount_usd_fixed || payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {payment.currency === 'MXN' && payment.amount_original && (
                      <div className="text-xs text-blue-600 mt-0.5">
                        ${payment.amount_original.toLocaleString()} MXN
                        {payment.fx_rate && ` (TC ${payment.fx_rate.toFixed(4)})`}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Select 
                      value={payment.status || 'reportado'} 
                      onValueChange={(value) => handleUpdateStatus(payment, value)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reportado">Reportado</SelectItem>
                        <SelectItem value="confirmado">Confirmado</SelectItem>
                        <SelectItem value="cambiado_usd">Cambiado a USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingPayment(payment);
                          setEditFormData({
                            date: payment.date,
                            currency: payment.currency || 'USD',
                            amount_original: payment.amount_original || payment.amount,
                            amount: payment.amount,
                            amount_usd_fixed: payment.amount_usd_fixed,
                            fx_rate: payment.fx_rate,
                            method: payment.method,
                            notes: payment.notes || ''
                          });
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteConfirm(payment)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-50 border-t border-stone-200">
              <tr>
                <td colSpan="5" className="p-3 text-right font-semibold text-stone-600">
                  Total:
                </td>
                <td className="p-3 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-bold text-green-600">
                      ${total.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {total.mxn > 0 && (
                      <span className="text-sm font-semibold text-blue-600">
                        ${total.mxn.toLocaleString()} MXN
                      </span>
                    )}
                  </div>
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