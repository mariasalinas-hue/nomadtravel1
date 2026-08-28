import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Printer, MapPin, CheckCircle, Plus, Trash2 } from 'lucide-react';

export default function AgentCommissionInvoice({ open, onClose, commissions, onMarkAsPaid }) {
  // Descontados: dinero que se le descuenta al agente (ej. invoice tarde).
  const [deductions, setDeductions] = useState([]);
  const addDeduction = () => setDeductions(prev => [...prev, { concept: '', amount: '' }]);
  const removeDeduction = (i) => setDeductions(prev => prev.filter((_, idx) => idx !== i));
  const updateDeduction = (i, field, val) => setDeductions(prev => prev.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)));

  if (!commissions || commissions.length === 0) return null;

  const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Group by agent
  const agentName = commissions[0]?.agent_name || 'Agente';
  const totalAgentCommission = commissions.reduce((sum, c) => sum + (c.agent_commission || 0), 0);
  const totalNomadCommission = commissions.reduce((sum, c) => sum + (c.nomad_commission || 0), 0);
  const totalCommission = commissions.reduce((sum, c) => sum + (c.estimated_amount || 0), 0);
  const totalDescontado = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const netToPay = totalAgentCommission - totalDescontado;

  const handlePrint = () => {
    window.print();
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
                        {money(commission.estimated_amount)}
                      </td>
                      <td className="p-3 text-right font-semibold" style={{ color: '#2E442A' }}>
                        {money(commission.agent_commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Descontados (editor en pantalla; no se imprime) */}
          <div className="mb-6 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-500">Descontados</h3>
                <p className="text-xs text-stone-400">Dinero descontado al agente (ej. invoice subido tarde). Se resta del total.</p>
              </div>
              <Button variant="outline" size="sm" onClick={addDeduction} className="rounded-lg">
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </div>
            {deductions.length === 0 ? (
              <p className="text-sm text-stone-400">Sin descuentos.</p>
            ) : (
              <div className="space-y-2">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="Concepto (ej. invoice tarde)" value={d.concept} onChange={(e) => updateDeduction(i, 'concept', e.target.value)} className="flex-1 rounded-lg" />
                    <Input type="number" placeholder="Monto" value={d.amount} onChange={(e) => updateDeduction(i, 'amount', e.target.value)} className="w-28 rounded-lg text-right" />
                    <button onClick={() => removeDeduction(i)} title="Quitar" className="p-2 text-stone-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-stone-50 rounded-xl p-4 space-y-2">
              {totalDescontado > 0 && (
                <>
                  <div className="flex justify-between text-sm text-stone-600">
                    <span>Subtotal comisiones</span>
                    <span>{money(totalAgentCommission)}</span>
                  </div>
                  {deductions.filter(d => (parseFloat(d.amount) || 0) > 0).map((d, i) => (
                    <div key={i} className="flex justify-between text-sm text-red-600">
                      <span className="truncate mr-2">{d.concept || 'Descuento'}</span>
                      <span className="whitespace-nowrap">-{money(parseFloat(d.amount) || 0)}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: '#2E442A' }}>
                <span className="font-bold" style={{ color: '#2E442A' }}>Total a Pagar</span>
                <span className="text-xl font-bold" style={{ color: '#2E442A' }}>{money(netToPay)}</span>
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
            onClick={onMarkAsPaid}
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