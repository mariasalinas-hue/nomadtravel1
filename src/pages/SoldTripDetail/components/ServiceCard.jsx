import { Edit2, Trash2, Copy, MoreVertical, TrendingUp, TrendingDown, StickyNote } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SERVICE_ICONS, SERVICE_COLORS } from '../constants/serviceConstants';
import { getServiceDetails, calculateExchangeAlert } from '../utils/serviceUtils';
import { getSupplierOutstanding } from '@/components/utils/serviceCost';

const RESERVATION_STATUS = {
  reservado: { label: 'Reservado',            bg: '#FEF3C7', color: '#92400E' },
  parcial:   { label: 'Parcialmente pagado',  bg: '#DBEAFE', color: '#1E40AF' },
  pagado:    { label: 'Pagado',               bg: '#F0FDF4', color: '#166534' },
  cancelado: { label: 'Cancelado',            bg: '#FEF2F2', color: '#991B1B' },
};

const PROVIDER_LABEL = {
  virtuoso: 'Virtuoso', preferred_partner: 'Preferred Partner', tbo: 'TBO',
  expedia_taap: 'Expedia TAAP', ratehawk: 'RateHawk', tablet_hotels: 'Tablet Hotels',
  dmc: 'DMC', otro: 'Otro',
  ytc: 'YTC', directo: 'Directo', ez_travel: 'EZ Travel',
  lozano_travel: 'Lozano Travel', consofly: 'Consofly',
};

function resolveProvider(raw) {
  if (!raw) return null;
  return PROVIDER_LABEL[raw] || raw;
}

export default function ServiceCard({
  service, supplierPayments, currentExchangeRates, onEdit, onDelete, onDuplicate, onUpdateStatus
}) {
  const Icon = SERVICE_ICONS[service.service_type] || SERVICE_ICONS.otro;
  const colors = SERVICE_COLORS[service.service_type] || SERVICE_COLORS.otro;
  const details = getServiceDetails(service);
  const exchangeAlert = calculateExchangeAlert(service, currentExchangeRates);

  const servicePayments = supplierPayments.filter(p => p.trip_service_id === service.id);
  const paidToSupplier = servicePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const hasNetoPayments = servicePayments.some(p => p.payment_type === 'neto');
  const outstanding = getSupplierOutstanding(service, paidToSupplier, hasNetoPayments);

  const reservationNumber = service.reservation_number
    || service.flight_reservation_number
    || service.tour_reservation_number
    || service.cruise_reservation_number
    || service.dmc_reservation_number
    || service.train_reservation_number;

  const providerRaw = service.reserved_by
    || service.flight_consolidator
    || service.cruise_provider
    || service.train_provider;
  const providerLabel = resolveProvider(providerRaw);

  const currentStatus = service.reservation_status || service.metadata?.reservation_status || 'reservado';
  const statusStyle = RESERVATION_STATUS[currentStatus] || RESERVATION_STATUS.reservado;

  return (
    <div className="bg-white rounded-xl group transition-all duration-200"
         style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
         onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'}
         onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'}>

      <div className="p-4 flex items-center gap-4">
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold truncate" style={{ color: '#1C1C1E' }}>
              {details.title}
            </h4>
            {/* Inline status select */}
            <Select value={currentStatus} onValueChange={(v) => onUpdateStatus(service.id, v)}>
              <SelectTrigger
                className="h-5 w-auto text-xs rounded-md px-2 border-0 gap-1"
                style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reservado">Reservado</SelectItem>
                <SelectItem value="parcial">Parcialmente pagado</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs mb-2 truncate" style={{ color: '#6B6B6F' }}>{details.subtitle}</p>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: '#F5F5F7', color: '#6B6B6F', fontFamily: 'Inter, sans-serif' }}>
              {service.booked_by === 'montecito' ? 'Montecito' : 'IATA Nomad'}
            </span>
            {providerLabel && providerLabel !== 'Preferred Partner' && (
              <span className="text-xs px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(45,70,41,0.07)', color: '#2D4629' }}>
                {providerLabel}
              </span>
            )}
            {reservationNumber && (
              <span className="text-xs px-2 py-0.5 rounded-md font-mono"
                    style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                #{reservationNumber}
              </span>
            )}
          </div>
        </div>

        {/* Financials */}
        <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-medium mb-0.5 uppercase tracking-wide" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>Total</p>
            <p className="text-sm font-bold" style={{ color: '#1C1C1E' }}>
              ${(service.total_price || 0).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium mb-0.5 uppercase tracking-wide" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>Comisión</p>
            <p className="text-sm font-bold" style={{ color: '#2D4629' }}>
              ${(service.commission || 0).toLocaleString()}
            </p>
          </div>
          {paidToSupplier > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-medium mb-0.5 uppercase tracking-wide" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>Pagado</p>
              <p className="text-sm font-bold" style={{ color: '#C9A84C' }}>
                ${paidToSupplier.toLocaleString()}
              </p>
            </div>
          )}
          {paidToSupplier > 0 && outstanding > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-medium mb-0.5 uppercase tracking-wide" style={{ color: '#AEAEB2', letterSpacing: '0.06em' }}>Saldo</p>
              <p className="text-sm font-bold" style={{ color: '#B45309' }}>
                ${outstanding.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"
                    className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#AEAEB2' }}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5 mr-2" /> Editar
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-3.5 h-3.5 mr-2" /> Duplicar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-red-600" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile financials */}
      <div className="sm:hidden px-4 pb-3 flex items-center gap-4">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Total</p>
          <p className="text-sm font-bold" style={{ color: '#1C1C1E' }}>${(service.total_price || 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Comisión</p>
          <p className="text-sm font-bold" style={{ color: '#2D4629' }}>${(service.commission || 0).toLocaleString()}</p>
        </div>
        {paidToSupplier > 0 && (
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Pagado</p>
            <p className="text-sm font-bold" style={{ color: '#C9A84C' }}>${paidToSupplier.toLocaleString()}</p>
          </div>
        )}
        {paidToSupplier > 0 && outstanding > 0 && (
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Saldo</p>
            <p className="text-sm font-bold" style={{ color: '#B45309' }}>${outstanding.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {service.notes && (
        <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
             style={{ background: '#FFFBEB', border: '1px solid rgba(201,168,76,0.2)', color: '#92400E' }}>
          <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
          {service.notes}
        </div>
      )}

      {/* Exchange alert */}
      {exchangeAlert && Math.abs(exchangeAlert.percentage) > 5 && (
        <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
             style={{
               background: exchangeAlert.isGain ? '#F0FDF4' : '#FEF2F2',
               border: `1px solid ${exchangeAlert.isGain ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'}`,
               color: exchangeAlert.isGain ? '#166534' : '#991B1B',
             }}>
          {exchangeAlert.isGain
            ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
            : <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />}
          <span>
            Tipo de cambio {exchangeAlert.isGain ? 'favorable' : 'desfavorable'} ({exchangeAlert.percentage}%) —
            {exchangeAlert.isGain ? ' Ahorras' : ' Pagas'} <strong>${exchangeAlert.usdDifference} USD</strong>
          </span>
        </div>
      )}
    </div>
  );
}
