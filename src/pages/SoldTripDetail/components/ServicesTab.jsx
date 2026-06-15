import { memo } from 'react';
import { Plus, Package } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import EmptyState from '@/components/ui/EmptyState';
import ServiceCard from './ServiceCard';
import { SERVICE_ICONS, SERVICE_LABELS, SERVICE_COLORS } from '../constants/serviceConstants';

const ServiceTypeSection = memo(({ type, typeServices, supplierPayments, currentExchangeRates, onEditService, onDeleteService, onDuplicateService, onUpdateServiceStatus }) => {
  const Icon = SERVICE_ICONS[type] || Package;
  const colors = SERVICE_COLORS[type] || SERVICE_COLORS.otro;

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold" style={{ color: '#1C1C1E', fontFamily: 'Inter, sans-serif' }}>
            {SERVICE_LABELS[type]}s
          </h4>
          <span className="text-xs" style={{ color: '#AEAEB2' }}>
            {typeServices.length}
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.05)' }} />
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {typeServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              supplierPayments={supplierPayments}
              currentExchangeRates={currentExchangeRates}
              onEdit={() => onEditService(service)}
              onDelete={() => onDeleteService(service)}
              onDuplicate={() => onDuplicateService(service)}
              onUpdateStatus={onUpdateServiceStatus}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

ServiceTypeSection.displayName = 'ServiceTypeSection';

export default function ServicesTab({
  services, servicesByType, supplierPayments, currentExchangeRates,
  totalServices, totalCommissions, onAddService, onEditService, onDeleteService, onDuplicateService, onUpdateServiceStatus
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden"
         style={{ border: '1px solid rgba(0,0,0,0.055)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}>
        <div>
          <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
            Servicios del Viaje
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>
            {services.length} servicio{services.length !== 1 ? 's' : ''} · Total{' '}
            <span style={{ color: '#1C1C1E', fontWeight: 600 }}>${totalServices.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={onAddService}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: '#2D4629' }}
        >
          <Plus className="w-3.5 h-3.5" /> Agregar servicio
        </button>
      </div>

      {/* Content */}
      {services.length === 0 ? (
        <div className="py-14">
          <EmptyState
            icon={Package}
            title="Sin servicios"
            description="Agrega los servicios incluidos en este viaje"
            actionLabel="Agregar Servicio"
            onAction={onAddService}
          />
        </div>
      ) : (
        <div className="p-5 space-y-7">
          {Object.entries(servicesByType).map(([type, typeServices]) => (
            <ServiceTypeSection
              key={type}
              type={type}
              typeServices={typeServices}
              supplierPayments={supplierPayments}
              currentExchangeRates={currentExchangeRates}
              onEditService={onEditService}
              onDeleteService={onDeleteService}
              onDuplicateService={onDuplicateService}
              onUpdateServiceStatus={onUpdateServiceStatus}
            />
          ))}
        </div>
      )}

      {/* Footer totals */}
      {services.length > 0 && (
        <div className="px-5 py-4 flex items-center justify-end gap-8"
             style={{ borderTop: '1px solid rgba(0,0,0,0.055)', background: '#FAFAFA' }}>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>
              Total servicios
            </p>
            <p className="text-lg font-bold" style={{ color: '#1C1C1E', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
              ${totalServices.toLocaleString()}
            </p>
          </div>
          <div className="w-px h-8" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>
              Total comisiones
            </p>
            <p className="text-lg font-bold" style={{ color: '#2D4629', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
              ${totalCommissions.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
