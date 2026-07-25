import React, { useState, useEffect, useMemo } from 'react';
import { supabaseAPI, supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Building2, Upload, FileText, X, Sparkles, CheckCircle, Search } from 'lucide-react';
import { toast } from "sonner";
import { CLIENT_PAYMENT_METHODS, SUPPLIER_PAYMENT_METHODS } from '@/config/paymentMethods';

const BANK_OPTIONS = [
  { value: 'bbva_mxn', label: 'BBVA MXN' },
  { value: 'bbva_usd', label: 'BBVA USD' },
  { value: 'base', label: 'BASE' },
  { value: 'wise', label: 'WISE' }
];

const getServiceLabel = (service) => {
  switch (service.service_type) {
    case 'hotel':
      return `Hotel: ${service.hotel_name || service.hotel_chain || 'Sin nombre'}`;
    case 'vuelo':
      return `Vuelo: ${service.airline || ''} ${service.route || ''}`;
    case 'traslado':
      return `Traslado: ${service.transfer_origin || ''} - ${service.transfer_destination || ''}`;
    case 'tour':
      return `Tour: ${service.tour_name || 'Sin nombre'}`;
    case 'crucero':
      return `Crucero: ${service.cruise_line || 'Sin nombre'}`;
    case 'tren':
      return `Tren: ${service.train_operator || service.train_route || 'Sin nombre'}`;
    case 'dmc':
      return `DMC: ${service.dmc_name || service.name || service.provider_name || service.supplier_name || service.description || 'Sin nombre'}`;
    default:
      return `Otro: ${service.other_name || 'Sin nombre'}`;
  }
};

export default function QuickPaymentDialog({ open, onClose, type }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('manual');
  const [smartFileUrls, setSmartFileUrls] = useState([]);
  const [smartUploading, setSmartUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [smartTripId, setSmartTripId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [smartSearchQuery, setSmartSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    sold_trip_id: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'USD',
    amount_original: '',
    fx_rate: '',
    method: 'transferencia',
    bank: '',
    payment_type: 'neto',
    supplier: '',
    trip_service_id: 'none',
    notes: '',
    receipt_url: '',
    confirmed: false
  });
  const [uploading, setUploading] = useState(false);

  // Fetch services for the selected trip (for supplier payments)
  const { data: tripServices = [] } = useQuery({
    queryKey: ['tripServices', formData.sold_trip_id],
    queryFn: () => supabaseAPI.entities.TripService.filter({ sold_trip_id: formData.sold_trip_id }),
    enabled: !!formData.sold_trip_id && type === 'supplier'
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await supabaseAPI.auth.getCurrentUser();
      // Obtener el perfil completo del usuario
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
      return profile || user;
    }
  });

  const { data: allSoldTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['soldTrips'],
    queryFn: () => supabaseAPI.entities.SoldTrip.list('-created_date')
  });

  // Show all sold trips (not just current user's trips)
  const soldTrips = useMemo(() => {
    return allSoldTrips || [];
  }, [allSoldTrips]);

  // Filter trips by search query
  const filteredTrips = useMemo(() => {
    if (!searchQuery) return soldTrips;
    const query = searchQuery.toLowerCase();
    return soldTrips.filter(trip => 
      trip.client_name?.toLowerCase().includes(query) ||
      trip.destination?.toLowerCase().includes(query) ||
      trip.trip_name?.toLowerCase().includes(query) ||
      trip.id?.toLowerCase().includes(query)
    );
  }, [soldTrips, searchQuery]);

  const filteredSmartTrips = useMemo(() => {
    if (!smartSearchQuery) return soldTrips;
    const query = smartSearchQuery.toLowerCase();
    return soldTrips.filter(trip => 
      trip.client_name?.toLowerCase().includes(query) ||
      trip.destination?.toLowerCase().includes(query) ||
      trip.trip_name?.toLowerCase().includes(query) ||
      trip.id?.toLowerCase().includes(query)
    );
  }, [soldTrips, smartSearchQuery]);

  useEffect(() => {
    if (open) {
      setFormData({
        sold_trip_id: '',
        date: new Date().toISOString().split('T')[0],
        currency: 'USD',
        amount_original: '',
        fx_rate: '',
        method: 'transferencia',
        bank: '',
        payment_type: 'neto',
        supplier: '',
        trip_service_id: 'none',
        notes: '',
        receipt_url: '',
        confirmed: false
      });
      setSmartFileUrls([]);
      setSmartTripId('');
      setActiveTab('manual');
      setSearchQuery('');
      setSmartSearchQuery('');
    }
  }, [open]);

  const handleSmartFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSmartUploading(true);
    try {
      const uploadedUrls = [];
      const bucketName = type === 'client' ? 'client-payments' : 'supplier-payments';
      for (const file of files) {
        const { file_url } = await supabaseAPI.storage.uploadFile(file, bucketName);
        uploadedUrls.push(file_url);
      }
      setSmartFileUrls(prev => [...prev, ...uploadedUrls]);
      toast.success(`${files.length} archivo(s) subido(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Error al subir archivos');
    } finally {
      setSmartUploading(false);
    }
  };

  const handleSmartImport = async () => {
    if (smartFileUrls.length === 0) {
      toast.error('Sube al menos un archivo');
      return;
    }
    if (!smartTripId) {
      toast.error('Selecciona un viaje');
      return;
    }

    setImporting(true);
    try {
      const functionName = type === 'client' ? 'importClientPaymentFromFiles' : 'importSupplierPaymentFromFiles';
      const response = await base44.functions.invoke(functionName, {
        file_urls: smartFileUrls,
        sold_trip_id: smartTripId
      });

      if (response.data.success) {
        toast.success(response.data.message);
        queryClient.invalidateQueries({ queryKey: ['soldTrips'] });
        queryClient.invalidateQueries({ queryKey: ['clientPayments'] });
        queryClient.invalidateQueries({ queryKey: ['supplierPayments'] });
        onClose();
      } else {
        toast.error(response.data.error || 'Error al importar');
      }
    } catch (error) {
      toast.error('Error al importar pagos');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const bucketName = type === 'client' ? 'client-payments' : 'supplier-payments';
      const { file_url } = await supabaseAPI.storage.uploadFile(file, bucketName);
      setFormData({ ...formData, receipt_url: file_url });
      toast.success('Comprobante subido');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const clientPaymentMutation = useMutation({
    mutationFn: async (data) => {
      return await supabaseAPI.entities.ClientPayment.create(data);
    },
    onSuccess: async (newPayment) => {
      // Import the recalculation function
      const { updateSoldTripAndPaymentPlanTotals } = await import('@/components/utils/soldTripRecalculations');
      await updateSoldTripAndPaymentPlanTotals(newPayment.sold_trip_id, queryClient);
      toast.success('Pago de cliente registrado');
      onClose();
    }
  });

  const supplierPaymentMutation = useMutation({
    mutationFn: async (data) => {
      return await supabaseAPI.entities.SupplierPayment.create(data);
    },
    onSuccess: async (newPayment) => {
      // Import the recalculation function
      const { updateSoldTripAndTripServiceTotals } = await import('@/components/utils/soldTripRecalculations');
      await updateSoldTripAndTripServiceTotals(newPayment.sold_trip_id, queryClient);
      toast.success('Pago a proveedor registrado');
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.sold_trip_id || !formData.amount_original) {
      toast.error('Selecciona un viaje y monto');
      return;
    }

    if (type === 'client') {
      // Validar monto
      const amount = parseFloat(formData.amount_original);
      if (!amount || amount <= 0) {
        toast.error('Debes ingresar un monto válido');
        return;
      }

      // Calculate amount_usd_fixed
      let amount_usd_fixed;
      let fx_rate = null;
      
      if (formData.currency === 'USD') {
        amount_usd_fixed = amount;
        fx_rate = null;
      } else if (formData.currency === 'MXN') {
        const rate = parseFloat(formData.fx_rate);
        if (!rate || rate <= 0) {
          toast.error('Debes ingresar un tipo de cambio válido para pagos en MXN');
          return;
        }
        fx_rate = rate;
        amount_usd_fixed = amount / rate;
      } else if (formData.currency === 'GBP') {
        const rate = parseFloat(formData.fx_rate);
        if (!rate || rate <= 0) {
          toast.error('Debes ingresar un tipo de cambio válido para pagos en GBP');
          return;
        }
        fx_rate = rate;
        amount_usd_fixed = amount * rate;
      }
      
      const paymentData = {
        sold_trip_id: formData.sold_trip_id,
        date: formData.date,
        currency: formData.currency,
        amount_original: amount,
        fx_rate: fx_rate,
        amount_usd_fixed: amount_usd_fixed,
        amount: amount_usd_fixed,
        method: formData.method,
        status: 'reportado',
        bank: formData.bank || undefined,
        notes: formData.notes,
        receipt_url: formData.receipt_url || undefined,
        created_by: currentUser?.email || currentUser?.id || 'unknown'
      };

      clientPaymentMutation.mutate(paymentData);
    } else {
      // Supplier payment
      const paymentData = {
        sold_trip_id: formData.sold_trip_id,
        trip_service_id: formData.trip_service_id === 'none' || !formData.trip_service_id ? null : formData.trip_service_id,
        date: formData.date,
        amount: parseFloat(formData.amount_original),
        payment_type: formData.payment_type,
        method: formData.method,
        notes: formData.notes,
        receipt_url: formData.receipt_url || undefined,
        supplier: formData.supplier || 'Proveedor',
        confirmed: formData.confirmed,
        created_by: currentUser?.email || currentUser?.id || 'unknown'
      };
      supplierPaymentMutation.mutate(paymentData);
    }
  };

  const isLoading = clientPaymentMutation.isPending || supplierPaymentMutation.isPending || uploading;
  const selectedTrip = soldTrips.find(t => t.id === formData.sold_trip_id);

  const selectedService = type === 'supplier' && formData.trip_service_id !== 'none'
    ? tripServices.find(s => s.id === formData.trip_service_id)
    : null;

  useEffect(() => {
    if (selectedService) {
      let supplierName = '';
      switch (selectedService.service_type) {
        case 'hotel':
          supplierName = selectedService.hotel_name || selectedService.hotel_chain || '';
          break;
        case 'vuelo':
          supplierName = selectedService.airline || '';
          break;
        case 'tour':
          supplierName = selectedService.tour_name || '';
          break;
        case 'crucero':
          supplierName = selectedService.cruise_line || '';
          break;
        case 'tren':
          supplierName = selectedService.train_operator || '';
          break;
        case 'dmc':
          supplierName = selectedService.dmc_name || selectedService.name || selectedService.provider_name || '';
          break;
        default:
          supplierName = selectedService.other_name || '';
      }
      setFormData(prev => ({ ...prev, supplier: supplierName }));
    }
  }, [selectedService]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: '#2E442A' }}>
            {type === 'client' ? (
              <><User className="w-5 h-5" /> Pago de Cliente</>
            ) : (
              <><Building2 className="w-5 h-5" /> Pago a Proveedor</>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="smart">
              <Sparkles className="w-4 h-4 mr-2" />
              Smart Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trip Selection */}
          <div className="space-y-2">
            <Label>Viaje Vendido *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 z-10" />
              <Input
                type="text"
                placeholder="Buscar por cliente, destino o viaje..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl pl-10 mb-2"
              />
            </div>
            <Select 
              value={formData.sold_trip_id} 
              onValueChange={(v) => setFormData({ ...formData, sold_trip_id: v })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tripsLoading ? "Cargando..." : "Seleccionar viaje"} />
              </SelectTrigger>
              <SelectContent>
                {filteredTrips.length === 0 ? (
                  <div className="p-4 text-center text-sm text-stone-500">
                    {searchQuery ? 'No se encontraron viajes' : 'No tienes viajes vendidos'}
                  </div>
                ) : (
                  filteredTrips.map(trip => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.client_name} - {trip.destination}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedTrip && (
              <p className="text-xs text-stone-500">
                Total: ${selectedTrip.total_price?.toLocaleString() || 0} | 
                Pagado: ${selectedTrip.total_paid_by_client?.toLocaleString() || 0}
              </p>
            )}
          </div>

          {/* Service Selection (only for supplier payments) */}
          {type === 'supplier' && (
            <div className="space-y-2">
              <Label>Asociar a Servicio (Opcional)</Label>
              <Select
                value={formData.trip_service_id}
                onValueChange={(v) => setFormData({ ...formData, trip_service_id: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecciona un servicio..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asociar</SelectItem>
                  {tripServices.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {getServiceLabel(service)} - ${service.total_price?.toLocaleString() || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-stone-500">
                Asocia este pago a un servicio específico para llevar control detallado
              </p>
            </div>
          )}

          {/* Supplier name (only for supplier payments) */}
          {type === 'supplier' && (
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Input
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Nombre del proveedor"
                className="rounded-xl"
                required
              />
            </div>
          )}

          {/* Currency selector (only for client payments) */}
          {type === 'client' && (
            <div className="space-y-2">
              <Label>Moneda del Pago *</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v, fx_rate: '' })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                  <SelectItem value="MXN">MXN (Pesos Mexicanos)</SelectItem>
                  <SelectItem value="GBP">GBP (Libras Esterlinas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto ({type === 'client' ? formData.currency : 'USD'}) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount_original}
                onChange={(e) => setFormData({ ...formData, amount_original: e.target.value })}
                placeholder="0.00"
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="rounded-xl"
                required
              />
            </div>
          </div>

          {/* Exchange Rate (only for MXN or GBP client payments) */}
          {type === 'client' && (formData.currency === 'MXN' || formData.currency === 'GBP') && (
            <div className="space-y-2">
              <Label>
                {formData.currency === 'MXN' ? 'Tipo de Cambio (USD/MXN) *' : 'Tipo de Cambio (GBP/USD) *'}
              </Label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={formData.fx_rate}
                onChange={(e) => setFormData({ ...formData, fx_rate: e.target.value })}
                placeholder={formData.currency === 'MXN' ? '17.87' : '1.27'}
                className="rounded-xl"
                required
              />
              {formData.amount_original && formData.fx_rate && parseFloat(formData.amount_original) > 0 && parseFloat(formData.fx_rate) > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  = ${(formData.currency === 'MXN'
                    ? parseFloat(formData.amount_original) / parseFloat(formData.fx_rate)
                    : parseFloat(formData.amount_original) * parseFloat(formData.fx_rate)
                  ).toFixed(2)} USD
                </p>
              )}
            </div>
          )}

          {/* Payment Method + Bank/PaymentType */}
          <div className="grid grid-cols-2 gap-4">
            {type === 'supplier' && (
              <div className="space-y-2">
                <Label>Tipo de Pago *</Label>
                <Select value={formData.payment_type} onValueChange={(v) => setFormData({ ...formData, payment_type: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neto">Neto</SelectItem>
                    <SelectItem value="bruto">Bruto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select
                value={formData.method}
                onValueChange={(v) => setFormData({ ...formData, method: v })}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(type === 'supplier' ? SUPPLIER_PAYMENT_METHODS : CLIENT_PAYMENT_METHODS).map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === 'client' && (
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={formData.bank} onValueChange={(v) => setFormData({ ...formData, bank: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar banco" /></SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Comprobante de Pago</Label>
            {formData.receipt_url ? (
              <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-xl border">
                <FileText className="w-4 h-4 text-stone-500" />
                <a 
                  href={formData.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
                >
                  Ver comprobante
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFormData({ ...formData, receipt_url: '' })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-stone-200 rounded-xl hover:border-stone-300 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                  ) : (
                    <Upload className="w-4 h-4 text-stone-400" />
                  )}
                  <span className="text-sm text-stone-500">
                    {uploading ? 'Subiendo...' : 'Subir PDF o imagen'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="rounded-xl text-white"
                  style={{ backgroundColor: '#2E442A' }}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Registrar Pago
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="smart">
            <div className="space-y-4 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 text-sm">Smart Import con IA</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Sube comprobantes de pago (PDFs o fotos) y la IA extraerá automáticamente los pagos
                    </p>
                  </div>
                </div>
              </div>

              {/* Trip Selection */}
              <div className="space-y-2">
                <Label>Viaje Vendido *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 z-10" />
                  <Input
                    type="text"
                    placeholder="Buscar por cliente, destino o viaje..."
                    value={smartSearchQuery}
                    onChange={(e) => setSmartSearchQuery(e.target.value)}
                    className="rounded-xl pl-10 mb-2"
                  />
                </div>
                <Select 
                  value={smartTripId} 
                  onValueChange={setSmartTripId}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={tripsLoading ? "Cargando..." : "Seleccionar viaje"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSmartTrips.length === 0 ? (
                      <div className="p-4 text-center text-sm text-stone-500">
                        {smartSearchQuery ? 'No se encontraron viajes' : 'No tienes viajes vendidos'}
                      </div>
                    ) : (
                      filteredSmartTrips.map(trip => (
                        <SelectItem key={trip.id} value={trip.id}>
                          {trip.client_name} - {trip.destination}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Subir Comprobantes (PDFs o Imágenes)</Label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    onChange={handleSmartFileUpload}
                    disabled={smartUploading || importing}
                    className="flex-1 text-sm"
                  />
                  {smartUploading && <Loader2 className="w-5 h-5 animate-spin text-stone-400" />}
                  {smartFileUrls.length > 0 && !smartUploading && <CheckCircle className="w-5 h-5 text-green-600" />}
                </div>
                {smartFileUrls.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-stone-600">{smartFileUrls.length} archivo(s) subido(s):</p>
                    {smartFileUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Archivo {index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSmartImport}
                  disabled={smartFileUrls.length === 0 || !smartTripId || importing}
                  className="rounded-xl text-white"
                  style={{ backgroundColor: '#2E442A' }}
                >
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Sparkles className="w-4 h-4 mr-2" />
                  Importar Pagos
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}