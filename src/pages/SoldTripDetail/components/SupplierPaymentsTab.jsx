import React from 'react';
import { Plus, Building2, Edit2, Trash2, FileText } from 'lucide-react';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/components/utils/dateHelpers';
import { PAYMENT_METHOD_LABELS as METHOD_LABEL } from '@/config/paymentMethods';

export default function SupplierPaymentsTab({
  supplierPayments, totalSupplierPaid, onAddPayment, onEditPayment, onDeletePayment
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden"
         style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3"
           style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}>
        <div>
          <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
            Pagos a Proveedores
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>
            Total pagado{' '}
            <span style={{ color: '#C9A84C', fontWeight: 600 }}>${totalSupplierPaid.toLocaleString()}</span>
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#AEAEB2', lineHeight: 1.5 }}>
            Indica si el pago fue bruto o neto para un control correcto de comisiones.
          </p>
        </div>
        <button
          onClick={onAddPayment}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: '#2D4629' }}
        >
          <Plus className="w-3.5 h-3.5" /> Registrar pago
        </button>
      </div>

      {/* Content */}
      {supplierPayments.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={Building2}
            title="Sin pagos registrados"
            description="Registra los pagos realizados a proveedores"
            actionLabel="Registrar Pago"
            onAction={onAddPayment}
          />
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          {[...supplierPayments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((payment) => {
            const method = METHOD_LABEL[payment.method] || payment.method;

            return (
              <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50 group">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(201,168,76,0.12)' }}>
                  <Building2 className="w-4 h-4" style={{ color: '#C9A84C' }} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1C1C1E' }}>
                      {payment.supplier}
                    </p>
                    {payment.trip_service_id && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md"
                            style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                        Asociado a servicio
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: '#C9A84C' }}>
                      ${(payment.amount || 0).toLocaleString()}
                    </span>
                    <span style={{ color: '#AEAEB2', fontSize: 11 }}>·</span>
                    <span className="text-xs" style={{ color: '#AEAEB2' }}>
                      {formatDate(payment.date, 'd MMM yyyy', { locale: es })}
                    </span>
                    {method && (
                      <>
                        <span style={{ color: '#AEAEB2', fontSize: 11 }}>·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md capitalize"
                              style={{ background: '#F5F5F7', color: '#6B6B6F' }}>
                          {method}
                        </span>
                      </>
                    )}
                    {payment.payment_type && (
                      <>
                        <span style={{ color: '#AEAEB2', fontSize: 11 }}>·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md capitalize"
                              style={{ background: 'rgba(45,70,41,0.07)', color: '#2D4629' }}>
                          {payment.payment_type}
                        </span>
                      </>
                    )}
                  </div>
                  {payment.notes && (
                    <p className="text-xs mt-1.5 px-2 py-1 rounded-md"
                       style={{ background: '#F5F5F7', color: '#6B6B6F' }}>
                      {payment.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {payment.receipt_url && (
                    <button
                      onClick={() => window.open(payment.receipt_url, '_blank')}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ color: '#AEAEB2' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.color = '#16A34A'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AEAEB2'; }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onEditPayment(payment)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: '#AEAEB2' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#1D4ED8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AEAEB2'; }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeletePayment(payment)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: '#AEAEB2' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AEAEB2'; }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
