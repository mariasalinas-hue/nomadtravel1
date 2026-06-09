import { es } from 'date-fns/locale';
import { formatDate } from '@/components/utils/dateHelpers';

export const getServiceDetails = (service) => {
  switch (service.service_type) {
    case 'hotel':
      return {
        title: service.hotel_name || 'Hotel',
        subtitle: `${service.hotel_city || ''} • ${service.nights || 0} noches`,
        extra: service.check_in ? `Check-in: ${formatDate(service.check_in, 'd MMM', { locale: es })}` : ''
      };
    case 'vuelo': {
      const airlineName = service.airline === 'Otro' ? (service.airline_other || 'Otro') : (service.airline || 'Vuelo');
      return {
        title: `${airlineName} ${service.flight_number || ''}`.trim(),
        subtitle: service.route || '',
        extra: service.flight_date ? formatDate(service.flight_date, 'd MMM yyyy', { locale: es }) : ''
      };
    }
    case 'traslado':
      return {
        title: `${service.transfer_origin || ''} → ${service.transfer_destination || ''}`,
        subtitle: `${service.transfer_type === 'privado' ? 'Privado' : 'Compartido'} • ${service.transfer_passengers || 1} pax`,
        extra: service.transfer_datetime ? formatDate(service.transfer_datetime, 'd MMM HH:mm', { locale: es }) : ''
      };
    case 'tour':
      return {
        title: service.tour_name || 'Tour',
        subtitle: `${service.tour_city || ''} • ${service.tour_people || 1} personas`,
        extra: service.tour_date ? formatDate(service.tour_date, 'd MMM yyyy', { locale: es }) : ''
      };
    case 'crucero':
      return {
        title: service.cruise_ship || service.cruise_line || 'Crucero',
        subtitle: `${service.cruise_itinerary || ''} • ${service.cruise_nights || 0} noches`,
        extra: service.cruise_departure_date ? `Salida: ${formatDate(service.cruise_departure_date, 'd MMM', { locale: es })}` : ''
      };
    case 'tren':
      return {
        title: `${service.train_operator || 'Tren'} ${service.train_number || ''}`,
        subtitle: service.train_route || '',
        extra: service.train_date ? `${formatDate(service.train_date, 'd MMM yyyy', { locale: es })}${service.train_departure_time ? ' • ' + service.train_departure_time : ''}` : ''
      };
    case 'dmc':
      return {
        title: service.dmc_name || 'DMC',
        subtitle: service.dmc_services || '',
        extra: service.dmc_destination ? `${service.dmc_destination}${service.dmc_date ? ' • ' + formatDate(service.dmc_date, 'd MMM yyyy', { locale: es }) : ''}` : (service.dmc_date ? formatDate(service.dmc_date, 'd MMM yyyy', { locale: es }) : '')
      };
    case 'otro':
      return {
        title: service.other_name || service.other_description?.substring(0, 50) || 'Servicio',
        subtitle: service.other_name && service.other_description ? service.other_description : '',
        extra: service.other_date ? formatDate(service.other_date, 'd MMM yyyy', { locale: es }) : ''
      };
    default:
      return { title: 'Servicio', subtitle: '', extra: '' };
  }
};

export const calculateExchangeAlert = (service, currentExchangeRates) => {
  if (!service.local_currency || service.local_currency === 'USD' || !service.quote_date || !service.quote_exchange_rate || !currentExchangeRates[service.local_currency]) {
    return null;
  }

  const originalRate = service.quote_exchange_rate;
  const currentRate = currentExchangeRates[service.local_currency];
  const difference = ((currentRate - originalRate) / originalRate) * 100;
  const originalUSD = service.local_amount * originalRate * 1.01;
  const currentUSD = service.local_amount * currentRate * 1.01;
  const usdDifference = currentUSD - originalUSD;

  if (Math.abs(difference) <= 2) {
    return null;
  }

  return {
    isGain: difference > 0,
    percentage: Math.abs(difference).toFixed(2),
    usdDifference: Math.abs(usdDifference).toFixed(2),
    originalRate,
    currentRate
  };
};
