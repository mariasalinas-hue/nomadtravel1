import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Printer, MapPin, CheckCircle, Plus, Trash2 } from 'lucide-react';

// Importe con signo según el tipo: las deducciones restan, los ajustes suman.
const signedAmount = (adj) => {
  const value = Number(adj.amount) || 0;
  return adj.type === 'deduction' ? -Math.abs(value) : Math.abs(value);
};

export default function AgentCommissionInvoice({ open, onClose, commissions, onMarkAsPaid }) {
  // Deducciones / ajustes capturados por el administrador en este invoice.
  const [adjustments, setAdjustments] = useState([]);
  const nextId = useRef(1);

  // Reiniciar las deducciones cada vez que se abre el invoice (puede ser otro agente).
  useEffect(() => {
    if (open) {
      setAdjustments([]);
      nextId.current = 1;
    }
  }, [open]);

  if (!commissions || commissions.length === 0) return null;

  // Group by agent
  const agentName = commissions[0]?.agent_name || 'Agente';
  const totalAgentCommission = commissions.reduce((sum, c) => sum + (c.agent_commission || 0), 0);

  const totalAdjustments = adjustments.reduce((sum, a) => sum + signedAmount(a), 0);
  const finalTotal = totalAgentCommission + totalAdjustments;

  const addAdjustment = () =>
    setAdjustments(prev => [...prev, { id: nextId.current++, label: '', amount: '', type: 'deduction' }]);
  const updateAdjustment = (id, field, value) =>
    setAdjustments(prev => prev.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  const removeAdjustment = (id) =>
    setAdjustments(prev => prev.filter(a => a.id !== id));

  // Solo se imprimen las deducciones con un importe distinto de cero.
  const printableAdjustments = adjustments.filter(a => (Number(a.amount) || 0) !== 0);

  const handlePrint = () => {
    window.print();
  };

  const handleMarkAsPaid = () => {
    onMarkAsPaid?.({
      adjustments: printableAdjustments.map(a => ({
        label: a.label?.trim() || (a.type === 'deduction' ? 'Deducción' : 'Ajuste'),
        type: a.type,
        amount: signedAmount(a),
      })),
      totalAdjustments,
      finalTotal,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between print:hidden">
          <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
            Invoice de Comisiones
          </DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="mt-6 print:mt-0" id="invoice-content">
          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#2E442A' }}
              >
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#2E442A' }}>Nomad Travel Society</h2>
                <p className="text-xs text-stone-500">San Pedro Garza García, N.L.</p>
                <p className="text-xs text-stone-500">contacto@nomadtravelsociety.com</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-stone-500">Fecha de Emisión</p>
              <p className="font-medium">{formatDate(new Date(), 'd MMMM yyyy', { locale: es })}</p>
              <p className="text-xs text-stone-400 mt-1">Invoice #INV-{formatDate(new Date(), 'yyyyMMdd')}</p>
            </div>
          </div>

          {/* Agent Info */}
          <div className="mb-8 p-4 bg-stone-50 rounded-xl">
            <h3 className="text-sm font-semibold text-stone-500 mb-2">Pago de Comisiones a:</h3>
            <p className="text-xl font-bold text-stone-800">{agentName}</p>
            <p className="text-sm text-stone-600 mt-1">Período: {formatDate(new Date(), 'MMMM yyyy', { locale: es })}</p>
          </div>

          {/* Commissions Table */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-stone-500 mb-4">Detalle de Comisiones</h3>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="text-left p-3 font-semibold text-stone-600">Viaje / Cliente</th>
                    <th className="text-left p-3 font-semibold text-stone-600">Proveedor</th>
                    <th className="text-right p-3 font-semibold text-stone-600">Comisión Total</th>
                    <th className="text-right p-3 font-semibold text-stone-600">Tu Parte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {commissions.map((commission, index) => (
                    <tr key={index} className="hover:bg-stone-50">
                      <td className="p-3">
                        <span className="font-medium text-stone-800">{commission.sold_trip_name || '-'}</span>
                        {commission.estimated_payment_date && (
                          <p className="text-xs text-stone-400">
                            {formatDate(commission.estimated_payment_date, 'd MMM yy', { locale: es })}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-stone-600">{commission.service_provider || '-'}</td>
                      <td className="p-3 text-right text-stone-600">
                        ${(commission.estimated_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-semibold" style={{ color: '#2E442A' }}>
                        ${(commission.agent_commission || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deducciones y Ajustes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-500">Deducciones y Ajustes</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addAdjustment}
                className="rounded-xl print:hidden"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Agregar
              </Button>
            </div>

            {/* Editor (solo en pantalla) */}
            <div className="space-y-2 print:hidden">
              {adjustments.length === 0 && (
                <p className="text-xs text-stone-400">
                  Agrega una deducción o ajuste si aplica. El total a pagar se recalcula automáticamente.
                </p>
              )}
              {adjustments.map((adj) => (
                <div key={adj.id} className="flex items-center gap-2">
                  <Input
                    value={adj.label}
                    onChange={(e) => updateAdjustment(adj.id, 'label', e.target.value)}
                    placeholder="Concepto (ej. Anticipo, Penalización)"
                    className="flex-1 rounded-xl"
                  />
                  <Select value={adj.type} onValueChange={(v) => updateAdjustment(adj.id, 'type', v)}>
                    <SelectTrigger className="w-36 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deduction">Deducción (−)</SelectItem>
                      <SelectItem value="addition">Ajuste (+)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adj.amount}
                      onChange={(e) => updateAdjustment(adj.id, 'amount', e.target.value)}
                      placeholder="0"
                      className="pl-6 rounded-xl text-right"
                    />
                  </div>
                  <button
                    onClick={() => removeAdjustment(adj.id)}
                    title="Eliminar"
                    className="p-2 rounded-lg text-stone-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen impreso de las deducciones */}
            {printableAdjustments.length > 0 && (
              <div className="hidden print:block border border-stone-200 rounded-xl overflow-hidden mt-2">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {printableAdjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td className="p-3 text-stone-600">
                          {adj.label?.trim() || (adj.type === 'deduction' ? 'Deducción' : 'Ajuste')}
                        </td>
                        <td className={`p-3 text-right font-semibold ${signedAmount(adj) < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                          {signedAmount(adj) < 0 ? '−' : '+'}${Math.abs(signedAmount(adj)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-stone-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Subtotal Comisiones</span>
                <span className="font-medium">${totalAgentCommission.toLocaleString()}</span>
              </div>

              {printableAdjustments.map((adj) => (
                <div key={adj.id} className="flex justify-between text-sm">
                  <span className="text-stone-500 truncate mr-2">
                    {adj.label?.trim() || (adj.type === 'deduction' ? 'Deducción' : 'Ajuste')}
                  </span>
                  <span className={`font-medium whitespace-nowrap ${signedAmount(adj) < 0 ? 'text-red-600' : 'text-stone-700'}`}>
                    {signedAmount(adj) < 0 ? '−' : '+'}${Math.abs(signedAmount(adj)).toLocaleString()}
                  </span>
                </div>
              ))}

              <div
                className="flex justify-between pt-2 border-t"
                style={{ borderColor: '#2E442A' }}
              >
                <span className="font-bold" style={{ color: '#2E442A' }}>Total a Pagar</span>
                <span className="text-xl font-bold" style={{ color: '#2E442A' }}>
                  ${finalTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-stone-200 text-center print:mt-8">
            <p className="text-sm text-stone-500">
              Este documento es un comprobante de pago de comisiones
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Nomad Travel Society | San Pedro Garza García, N.L.
            </p>
          </div>
        </div>

        {/* Action Buttons - Print Hidden */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4 print:hidden">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cerrar
          </Button>
          <Button
            onClick={handleMarkAsPaid}
            className="text-white rounded-xl"
            style={{ backgroundColor: '#2E442A' }}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Marcar como Pagadas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
