import React from 'react';
import { addMonths, isAfter, isBefore, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plane } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import EmptyState from '@/components/ui/EmptyState';
import { parseLocalDate, formatDate } from '@/components/utils/dateHelpers';

export default function UpcomingTrips({ soldTrips }) {
  const now = new Date();
  const threeMonthsFromNow = addMonths(now, 3);

  const sortedTrips = [...soldTrips]
    .filter(trip => {
      if (!trip.start_date) return false;
      const tripDate = parseLocalDate(trip.start_date);
      return isAfter(tripDate, now) && isBefore(tripDate, threeMonthsFromNow);
    })
    .sort((a, b) => parseLocalDate(a.start_date) - parseLocalDate(b.start_date));

  // Build a friendly countdown label for each trip
  const daysLabel = (days) => {
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    return `En ${days} días`;
  };

  if (sortedTrips.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 h-full">
        <div className="p-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Viajes Próximos</h3>
        </div>
        <EmptyState
          icon={Plane}
          title="Sin viajes próximos"
          description="Los viajes de los próximos 3 meses aparecerán aquí"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 h-full flex flex-col">
      <div className="p-4 border-b border-stone-100 flex items-center gap-2">
        <Plane className="w-4 h-4" style={{ color: '#2E442A' }} />
        <h3 className="text-sm font-semibold text-stone-800">Viajes Próximos</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2E442A15', color: '#2E442A' }}>
          {sortedTrips.length}
        </span>
      </div>

      <div className="p-2 flex-1 min-h-0 overflow-y-auto">
        {sortedTrips.map((trip) => {
          const days = differenceInDays(parseLocalDate(trip.start_date), now);
          // Less than a month away → highlighted in red
          const isUrgent = days < 30;
          return (
            <Link
              key={trip.id}
              to={createPageUrl(`SoldTripDetail?id=${trip.id}`)}
              className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg hover:bg-stone-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-stone-800 truncate">{trip.client_name}</p>
                <p className="text-xs text-stone-500 truncate">
                  {trip.destination} • {formatDate(trip.start_date, 'd MMM yy', { locale: es })}
                </p>
              </div>
              <span
                className="text-xs font-semibold whitespace-nowrap px-2 py-1 rounded-lg"
                style={{
                  color: isUrgent ? '#DC2626' : '#2E442A',
                  background: isUrgent ? 'rgba(220,38,38,0.08)' : '#2E442A12'
                }}
              >
                {daysLabel(days)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
