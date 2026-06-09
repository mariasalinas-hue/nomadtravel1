import React, { memo } from 'react';
import { DollarSign, TrendingUp, Wallet, TrendingDown, Building2, AlertTriangle } from 'lucide-react';

const FinancialCard = memo(({ label, value, sub, icon: Icon, accent, negative }) => (
  <div className="bg-white rounded-2xl p-4 flex flex-col gap-3"
       style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium tracking-wide uppercase"
            style={{ color: '#AEAEB2', letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: accent + '18' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      </div>
    </div>
    <div>
      <p className="text-xl font-bold leading-tight"
         style={{ color: negative ? '#DC2626' : '#1C1C1E', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
        {typeof value === 'number'
          ? (value < 0 ? `-$${Math.abs(value).toLocaleString()}` : `$${value.toLocaleString()}`)
          : value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{sub}</p>}
    </div>
  </div>
));

FinancialCard.displayName = 'FinancialCard';

const ProgressBar = memo(({ progress }) => (
  <div className="bg-white rounded-2xl p-4"
       style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium tracking-wide uppercase"
            style={{ color: '#AEAEB2', letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif' }}>
        Progreso cobro
      </span>
      <span className="text-xs font-semibold" style={{ color: '#1C1C1E' }}>{progress}%</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0F0F2' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${Math.min(progress, 100)}%`,
          background: progress >= 100 ? '#2D4629' : progress >= 50 ? '#C9A84C' : '#DC2626'
        }}
      />
    </div>
    <p className="text-xs mt-2" style={{ color: '#AEAEB2' }}>
      {progress >= 100 ? 'Cobro completo' : progress >= 50 ? 'En proceso' : 'Pendiente'}
    </p>
  </div>
));

ProgressBar.displayName = 'ProgressBar';

export default function FinancialSummary({ metrics }) {
  const { totalServices, totalCommissions, totalClientPaid, totalSupplierPaid, paymentProgress } = metrics;
  const porCobrar = totalServices - totalClientPaid;
  // Si el cobrado supera el total registrado (con tolerancia de $1 por redondeo),
  // probablemente faltan servicios por registrar.
  const isOverpaid = porCobrar < -1;
  const overpaidAmount = Math.abs(porCobrar);
  const displayPorCobrar = isOverpaid ? 0 : Math.max(0, porCobrar);
  const displayProgress = Math.min(paymentProgress, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-px h-4 rounded-full" style={{ background: 'var(--luxury-gold)' }} />
        <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
          Resumen Financiero
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <FinancialCard
          label="Total"
          value={totalServices}
          sub="Valor del viaje"
          icon={DollarSign}
          accent="#1C1C1E"
        />
        <FinancialCard
          label="Comisión"
          value={totalCommissions}
          sub={totalServices > 0 ? `${((totalCommissions / totalServices) * 100).toFixed(1)}% del total` : undefined}
          icon={TrendingUp}
          accent="#2D4629"
        />
        <FinancialCard
          label="Cobrado"
          value={totalClientPaid}
          sub="Del cliente"
          icon={Wallet}
          accent="#16A34A"
        />
        <FinancialCard
          label="Por cobrar"
          value={displayPorCobrar}
          sub={isOverpaid ? 'Cobrado de más — revisar' : (displayPorCobrar <= 0 ? 'Al corriente' : 'Pendiente')}
          icon={isOverpaid ? AlertTriangle : (displayPorCobrar > 0 ? TrendingDown : TrendingUp)}
          accent={isOverpaid ? '#D97706' : (displayPorCobrar > 0 ? '#DC2626' : '#16A34A')}
          negative={displayPorCobrar > 0}
        />
        <FinancialCard
          label="Proveedores"
          value={totalSupplierPaid}
          sub="Pagado"
          icon={Building2}
          accent="#C9A84C"
        />
        <ProgressBar progress={displayProgress} />
      </div>

      {isOverpaid && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
             style={{ background: '#FFFBEB', border: '1px solid rgba(217,119,6,0.25)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            El <strong>cobrado (${totalClientPaid.toLocaleString()})</strong> supera el{' '}
            <strong>total de servicios registrados (${totalServices.toLocaleString()})</strong> por{' '}
            <strong>${overpaidAmount.toLocaleString()}</strong>. Es posible que falten servicios por registrar.
          </p>
        </div>
      )}
    </div>
  );
}
