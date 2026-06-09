import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { toast } from "sonner";

const CLIENT_PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'link_pago', label: 'Link de Pago' },
  { value: 'tarjeta_cliente', label: 'Pagado Directo con Tarjeta de Cliente' }
];

const BANK_OPTIONS = [
  { value: 'bbva_mxn', label: 'BBVA MXN' },
  { value: 'bbva_usd', label: 'BBVA USD' },
  { value: 'base', label: 'BASE' },
  { value: 'wise', label: 'WISE' }
];

const today = () => new Date().toISOString().split('T')[0];

export default function PaymentForm({ open, onClose, payment, soldTripId, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    date: '',
    currency: 'USD',
    amount_original: '',
    fx_rate: '',
    method: 'transferencia',
    bank: '',
    notes: '',
    status: 'reportado'
  });

  useEffect(() => {
    if (payment) {
      setFormData({
        date: payment.date || '',
        currency: payment.currency || 'USD',
        amount_original: payment.amount_original || payment.amount || '',
        fx_rate: payment.fx_rate || '',
        method: payment.method || 'transferencia',
        bank: payment.bank || '',
        notes: payment.notes || '',
        status: payment.status || (payment.confirmed ? 'confirmado' : 'reportado')
      });
    } else {
      setFormData({
        date: today(),
        currency: 'USD',
        amount_original: '',
        fx_rate: '',
        method: 'transferencia',
        bank: '',
        notes: '',
        status: 'reportado'
      });
    }
  }, [payment, open]);

  const handleSubmit = (e) => {
    e.preventDefault();

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
      sold_trip_id: soldTripId,
      date: formData.date,
      currency: formData.currency,
      amount_original: amount,
      fx_rate: fx_rate,
      amount_usd_fixed: amount_usd_fixed,
      amount: amount_usd_fixed, // backward compatibility
      method: formData.method,
      status: formData.status || 'reportado',
      confirmed: formData.status === 'confirmado', // backward compatibility
      bank: formData.bank || undefined,
      notes: formData.notes
    };

    onSave(paymentData);
  };

  const isFutureDate = formData.date && formData.date > today();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
            {payment ? 'Editar Pago de Cliente' : 'Nuevo Pago de Cliente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="rounded-xl"
            />
            {isFutureDate && (
              <p className="text-xs text-amber-600">⚠️ La fecha es futura. Verifica que sea correcta.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Moneda *</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD (Dólares)</SelectItem>
                <SelectItem value="MXN">MXN (Pesos Mexicanos)</SelectItem>
                <SelectItem value="GBP">GBP (Libras Esterlinas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto ({formData.currency}) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount_original}
                onChange={(e) => setFormData({ ...formData, amount_original: e.target.value })}
                required
                className="rounded-xl"
                placeholder="0.00"
              />
            </div>
            {(formData.currency === 'MXN' || formData.currency === 'GBP') && (
              <div className="space-y-2">
                <Label>
                  {formData.currency === 'MXN' ? 'Tipo de Cambio (USD/MXN) *' : 'Tipo de Cambio (GBP/USD) *'}
                </Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={formData.fx_rate}
                  onChange={(e) => setFormData({ ...formData, fx_rate: e.target.value })}
                  required
                  className="rounded-xl"
                  placeholder={formData.currency === 'MXN' ? '17.87' : '1.27'}
                />
                {formData.amount_original && formData.fx_rate && parseFloat(formData.amount_original) > 0 && parseFloat(formData.fx_rate) > 0 && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    = ${(formData.currency === 'MXN'
                      ? parseFloat(formData.amount_original) / parseFloat(formData.fx_rate)
                      : parseFloat(formData.amount_original) * parseFloat(formData.fx_rate)
                    ).toFixed(2)} USD
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select value={formData.method} onValueChange={(v) => setFormData({ ...formData, method: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reportado">Reportado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
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
              {payment ? 'Actualizar' : 'Registrar Pago'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
