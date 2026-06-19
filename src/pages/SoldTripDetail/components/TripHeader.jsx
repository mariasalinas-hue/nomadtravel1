import { memo } from 'react';
import { Link } from 'react-router-dom';
import { es } from 'date-fns/locale';
import { ArrowLeft, MapPin, Calendar, Users, Edit2, FileText, Clock, Hash, Share2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPageUrl } from '@/utils';
import { formatDate } from '@/components/utils/dateHelpers';

const STATUS_LUXURY = {
  pendiente: { label: 'Pendiente',   bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  parcial:   { label: 'Parcial',     bg: '#EFF6FF', color: '#1E40AF', dot: '#3B82F6' },
  pagado:    { label: 'Pagado',      bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
  completado:{ label: 'Completado',  bg: '#F5F3FF', color: '#5B21B6', dot: '#8B5CF6' },
};

const Pill = memo(({ icon: Icon, children, green }) => (
  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
       style={{
         background: green ? 'rgba(45,70,41,0.07)' : '#F5F5F7',
         color: green ? '#2D4629' : '#3C3C43',
         border: green ? '1px solid rgba(45,70,41,0.15)' : '1px solid rgba(0,0,0,0.06)',
       }}>
    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
    {children}
  </div>
));
Pill.displayName = 'Pill';

const StatusBadge = memo(({ status }) => {
  const s = STATUS_LUXURY[status] || STATUS_LUXURY.pendiente;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

const DaysUntilBadge = memo(({ days }) => {
  const urgent = days <= 7;
  const soon = days <= 30;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{
            background: urgent ? '#FEF2F2' : soon ? '#FFF7ED' : '#EFF6FF',
            color: urgent ? '#991B1B' : soon ? '#9A3412' : '#1E40AF',
          }}>
      <Clock className="w-3 h-3 flex-shrink-0" />
      {days === 0 ? '¡Hoy!' : `En ${days}d`}
    </span>
  );
});
DaysUntilBadge.displayName = 'DaysUntilBadge';

export default function TripHeader({
  soldTrip, paymentPlan, daysUntilTrip, isTripPast,
  onEditTrip, onCreatePaymentPlan, onOpenInvoice, onUpdateStatus, onShare
}) {
  const sharedCount = Array.isArray(soldTrip.metadata?.shared_with) ? soldTrip.metadata.shared_with.length : 0;
  const clientNames = soldTrip.metadata?.clients?.length > 1
    ? soldTrip.metadata.clients.map(c => c.name).join(' & ')
    : soldTrip.client_name;

  return (
    <div className="bg-white rounded-2xl overflow-hidden"
         style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}>

      {/* Gold top rule */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', opacity: 0.5 }} />

      <div className="p-5 md:p-6">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Back button */}
            <Link to={createPageUrl('SoldTrips')} className="flex-shrink-0 mt-0.5">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: '#F5F5F7', color: '#6B6B6F' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EBEBED'}
                      onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-2">
                <h1 style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 'clamp(18px, 3vw, 24px)',
                  fontWeight: 600,
                  color: '#1C1C1E',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2
                }}>
                  {clientNames}
                </h1>
                <StatusBadge status={soldTrip.status} />
                {soldTrip.file_number && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md"
                        style={{ background: '#F5F5F7', color: '#AEAEB2', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <Hash className="w-2.5 h-2.5" />
                    {soldTrip.file_number}
                  </span>
                )}
              </div>

              {soldTrip.trip_name && (
                <p className="text-sm mb-3" style={{ color: '#6B6B6F' }}>{soldTrip.trip_name}</p>
              )}

              {/* Info pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <Pill icon={MapPin} green>{soldTrip.destination}</Pill>
                <Pill icon={Calendar}>
                  {formatDate(soldTrip.start_date, 'd MMM yyyy', { locale: es })}
                </Pill>
                {soldTrip.travelers && (
                  <Pill icon={Users}>
                    {soldTrip.travelers} viajero{soldTrip.travelers !== 1 ? 's' : ''}
                  </Pill>
                )}
                {!isTripPast && daysUntilTrip >= 0 && (
                  <DaysUntilBadge days={daysUntilTrip} />
                )}
              </div>
            </div>
          </div>

          {/* Actions — desktop */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onEditTrip}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EBEBED'}
              onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
            >
              <Edit2 className="w-3.5 h-3.5" /> Editar
            </button>

            {paymentPlan.length === 0 && (
              <button
                onClick={onCreatePaymentPlan}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#EBEBED'}
                onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
              >
                <Calendar className="w-3.5 h-3.5" /> Plan de pagos
              </button>
            )}

            <button
              onClick={onOpenInvoice}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EBEBED'}
              onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
            >
              <FileText className="w-3.5 h-3.5" /> Invoice
            </button>

            <button
              onClick={onShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EBEBED'}
              onMouseLeave={e => e.currentTarget.style.background = '#F5F5F7'}
            >
              <Share2 className="w-3.5 h-3.5" /> Compartir{sharedCount > 0 ? ` (${sharedCount})` : ''}
            </button>

            <Select value={soldTrip.status} onValueChange={onUpdateStatus}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-lg"
                             style={{ border: '1px solid rgba(0,0,0,0.1)', background: '#FAFAFA' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions — mobile */}
        <div className="flex md:hidden gap-2 mt-4 flex-wrap">
          <button
            onClick={onEditTrip}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={onOpenInvoice}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <FileText className="w-3.5 h-3.5" /> Invoice
          </button>
          <button
            onClick={onShare}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: '#F5F5F7', color: '#3C3C43', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <Share2 className="w-3.5 h-3.5" /> Compartir{sharedCount > 0 ? ` (${sharedCount})` : ''}
          </button>
          <Select value={soldTrip.status} onValueChange={onUpdateStatus}>
            <SelectTrigger className="flex-1 h-8 text-xs rounded-lg"
                           style={{ border: '1px solid rgba(0,0,0,0.1)', background: '#FAFAFA' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
