import React from 'react';
import { Plus, CreditCard, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/components/utils/dateHelpers';
import { PAYMENT_METHOD_LABELS as METHOD_LABEL } from '@/config/paymentMethods';

export default function ClientPaymentsTab({
  clientPayments, totalClientPaid, totalServices, onAddPayment, onEditPayment, onDeletePayment
}) {
  const progress = totalServices > 0 ? Math.min((totalClientPaid / totalServices) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden"
         style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
              Pagos del Cliente
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>
              Cobrado{' '}
              <span style={{ color: '#16A34A', fontWeight: 600 }}>${totalClientPaid.toLocaleString()}</span>
              {' '}de{' '}
              <span style={{ color: '#1C1C1E', fontWeight: 600 }}>${totalServices.toLocaleString()}</span>
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

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F0F2' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: progress >= 100 ? '#2D4629' : progress >= 60 ? '#16A34A' : '#C9A84C',
            }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: '#AEAEB2' }}>
          Si el pago es en MXN, captura el tipo de cambio del día.
        </p>
      </div>

      {/* Content */}
      {clientPayments.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={CreditCard}
            title="Sin pagos registrados"
            description="Registra los pagos recibidos del cliente"
            actionLabel="Registrar Pago"
            onAction={onAddPayment}
          />
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
          {[...clientPayments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((payment) => {
            const currency = payment.currency || 'USD';
            const amountUSD = payment.amount_usd_fixed || payment.amount || 0;
            const amountOriginal = payment.amount_original || payment.amount || 0;
            const fxRate = payment.fx_rate;
            const method = METHOD_LABEL[payment.method] || payment.method;

            return (
              <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50 group">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <DollarSign className="w-4 h-4" style={{ color: '#16A34A' }} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: '#16A34A' }}>
                      +${amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </p>
                    {currency === 'MXN' && (
                      <span className="text-xs" style={{ color: '#6B6B6F' }}>
                        ${amountOriginal.toLocaleString()} MXN{fxRate ? ` · TC ${fxRate.toFixed(4)}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: '#AEAEB2' }}>
                      {formatDate(payment.date, 'd MMM yyyy', { locale: es })}
                    </span>
                    {method && (
                      <>
                        <span style={{ color: '#AEAEB2' }}>·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-md capitalize"
                              style={{ background: '#F5F5F7', color: '#6B6B6F' }}>
                          {method}
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
