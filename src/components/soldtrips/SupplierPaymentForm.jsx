import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { supabaseAPI } from '@/api/supabaseClient';
import { toast } from "sonner";

const SUPPLIER_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ms_beyond', label: 'MS Beyond' },
  { value: 'capital_one_blue', label: 'Capital One Blue' },
  { value: 'capital_one_green', label: 'Capital One Green' },
  { value: 'amex', label: 'American Express' },
  { value: 'amex_verde', label: 'American Express Verde' },
  { value: 'tarjeta_cliente', label: 'Tarjeta de Cliente' },
];

const today = () => new Date().toISOString().split('T')[0];

// Deriva el nombre del proveedor a partir del servicio seleccionado
function deriveSupplierName(service) {
  if (!service) return '';
  switch (service.service_type) {
    case 'hotel': return service.hotel_name || service.hotel_chain || '';
    case 'vuelo': return service.airline || '';
    case 'tour': return service.tour_name || '';
    case 'crucero': return service.cruise_line || '';
    case 'tren': return service.train_operator || '';
    case 'dmc': return service.dmc_name || service.name || service.provider_name || '';
    default: return service.other_name || '';
  }
}

function getServiceLabel(service) {
  switch (service.service_type) {
    case 'hotel': return `Hotel: ${service.hotel_name || service.hotel_chain || 'Sin nombre'}`;
    case 'vuelo': return `Vuelo: ${service.airline || ''} ${service.route || ''}`;
    case 'traslado': return `Traslado: ${service.transfer_origin || ''} - ${service.transfer_destination || ''}`;
    case 'tour': return `Tour: ${service.tour_name || 'Sin nombre'}`;
    case 'crucero': return `Crucero: ${service.cruise_line || 'Sin nombre'}`;
    case 'tren': return `Tren: ${service.train_operator || service.train_route || 'Sin nombre'}`;
    case 'dmc': return `DMC: ${service.dmc_name || service.name || service.provider_name || 'Sin nombre'}`;
    default: return `Otro: ${service.other_name || 'Sin nombre'}`;
  }
}

export default function SupplierPaymentForm({ open, onClose, soldTripId, services, payment, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    supplier: '',
    date: today(),
    amount: '',
    payment_type: 'neto',
    method: 'transferencia',
    trip_service_id: 'none',
    receipt_url: '',
    notes: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setFormData({
        supplier: payment.supplier || '',
        date: payment.date || today(),
        amount: payment.amount ?? '',
        payment_type: payment.payment_type || 'neto',
        method: payment.method || 'transferencia',
        trip_service_id: payment.trip_service_id || 'none',
        receipt_url: payment.receipt_url || '',
        notes: payment.notes || ''
      });
    } else {
      setFormData({
        supplier: '',
        date: today(),
        amount: '',
        payment_type: 'neto',
        method: 'transferencia',
        trip_service_id: 'none',
        receipt_url: '',
        notes: ''
      });
    }
  }, [open, payment]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await supabaseAPI.storage.uploadFile(file, 'supplier-payments');
      setFormData(prev => ({ ...prev, receipt_url: file_url }));
      toast.success('Comprobante subido');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  // Auto-rellena el proveedor SOLO cuando el usuario elige un servicio (no pisa lo escrito al editar)
  const handleServiceChange = (value) => {
    setFormData(prev => {
      const next = { ...prev, trip_service_id: value };
      if (value !== 'none') {
        const derived = deriveSupplierName(services.find(s => s.id === value));
        if (derived) next.supplier = derived;
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast.error('Debes ingresar un monto válido');
      return;
    }
    onSave({
      ...formData,
      sold_trip_id: soldTripId,
      amount,
      trip_service_id: formData.trip_service_id === 'none' || !formData.trip_service_id ? null : formData.trip_service_id
    });
  };

  const isFutureDate = formData.date && formData.date > today();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{payment ? 'Editar Pago a Proveedor' : 'Registrar Pago a Proveedor'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label>Asociar a Servicio (Opcional)</Label>
            <Select value={formData.trip_service_id} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un servicio..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asociar</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {getServiceLabel(service)} - ${(service.total_price ?? 0).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-stone-500 mt-1">
              Asocia este pago a un servicio específico para llevar control detallado
            </p>
          </div>

          <div>
            <Label>Proveedor *</Label>
            <Input
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Nombre del proveedor"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
              {isFutureDate && (
                <p className="text-xs text-amber-600 mt-1">⚠️ La fecha es futura. Verifica que sea correcta.</p>
              )}
            </div>
            <div>
              <Label>Monto (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Pago *</Label>
              <Select value={formData.payment_type} onValueChange={(value) => setFormData({ ...formData, payment_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neto">Neto</SelectItem>
                  <SelectItem value="bruto">Bruto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método de Pago *</Label>
              <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Comprobante de Pago</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
            </div>
            {formData.receipt_url && (
              <a
                href={formData.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
              >
                Ver comprobante subido
              </a>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {payment ? 'Actualizar Pago' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
