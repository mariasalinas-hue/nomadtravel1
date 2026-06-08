import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAPI } from '@/api/supabaseClient';
import { differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, CheckCircle, Loader2, MapPin, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { parseLocalDate, formatDate } from '@/components/utils/dateHelpers';
import { TIMELINE_REMINDERS, TIMELINE_ORDER, TIMELINE_THRESHOLD_DAYS } from '@/components/utils/reminderTemplate';

// Only initialize reminders for trips departing within ~6 months
const AUTO_CREATE_HORIZON_DAYS = 200;

export default function ActiveReminders({ userEmail, isAdmin }) {
  const queryClient = useQueryClient();
  const initializedRef = useRef(new Set());
  const [expanded, setExpanded] = useState({});

  const { data: soldTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['soldTrips', userEmail, isAdmin],
    queryFn: async () => {
      if (!userEmail) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list();
      return supabaseAPI.entities.SoldTrip.filter({ created_by: userEmail });
    },
    enabled: !!userEmail
  });

  const { data: allReminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: ['allReminders'],
    queryFn: () => supabaseAPI.entities.TripReminder.list(),
    enabled: true
  });

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.TripReminder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allReminders'] })
  });

  const createRemindersMutation = useMutation({
    mutationFn: (reminders) => supabaseAPI.entities.TripReminder.bulkCreate(reminders),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allReminders'] })
  });

  const now = new Date();

  // Upcoming trips (future start date)
  const upcomingTrips = soldTrips.filter(trip => {
    if (!trip.start_date) return false;
    const tripDate = parseLocalDate(trip.start_date);
    return tripDate && !isNaN(tripDate.getTime()) && tripDate > now;
  });

  // (C) Auto-create the reminder set for any upcoming trip that doesn't have one yet
  useEffect(() => {
    if (tripsLoading || remindersLoading) return;
    upcomingTrips.forEach(trip => {
      const daysUntil = differenceInDays(parseLocalDate(trip.start_date), now);
      if (daysUntil > AUTO_CREATE_HORIZON_DAYS) return;
      const hasAny = allReminders.some(r => r.sold_trip_id === trip.id);
      if (hasAny || initializedRef.current.has(trip.id)) return;

      initializedRef.current.add(trip.id);
      const toCreate = [];
      Object.entries(TIMELINE_REMINDERS).forEach(([period, info]) => {
        info.tasks.forEach(task => {
          toCreate.push({
            sold_trip_id: trip.id,
            timeline_period: period,
            task,
            completed: false,
            created_by: userEmail || 'unknown'
          });
        });
      });
      if (toCreate.length > 0) createRemindersMutation.mutate(toCreate);
    });
  }, [tripsLoading, remindersLoading, allReminders, soldTrips]);

  // (A + B) For each trip, collect reminders whose stage has already arrived and aren't completed
  const tripsWithPending = upcomingTrips
    .map(trip => {
      const daysUntil = differenceInDays(parseLocalDate(trip.start_date), now);
      const pending = allReminders.filter(r => {
        if (r.sold_trip_id !== trip.id || r.completed) return false;
        const threshold = TIMELINE_THRESHOLD_DAYS[r.timeline_period];
        return threshold != null && daysUntil <= threshold;
      });
      if (pending.length === 0) return null;
      return { trip, daysUntil, pending };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const totalPending = tripsWithPending.reduce((sum, t) => sum + t.pending.length, 0);

  const toggle = (tripId) => setExpanded(prev => ({ ...prev, [tripId]: !prev[tripId] }));

  const daysLabel = (days) => {
    if (days <= 0) return 'Hoy';
    if (days === 1) return 'Mañana';
    return `En ${days} días`;
  };

  const Header = () => (
    <div className="flex items-center gap-2 mb-3">
      <Bell className="w-4 h-4" style={{ color: '#2E442A' }} />
      <h2 className="font-semibold text-stone-800 text-sm">Recordatorios Activos</h2>
      {totalPending > 0 && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#2E442A15', color: '#2E442A' }}>
          {totalPending}
        </span>
      )}
    </div>
  );

  if (tripsLoading || remindersLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 h-full">
        <Header />
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2E442A' }} />
        </div>
      </div>
    );
  }

  if (tripsWithPending.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 h-full">
        <Header />
        <div className="text-center py-6">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-50" />
          <p className="text-xs text-stone-500">No hay recordatorios pendientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 h-full flex flex-col">
      <Header />

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {tripsWithPending.map(({ trip, daysUntil, pending }) => {
          const isOpen = !!expanded[trip.id];
          const isUrgent = daysUntil < 30;
          return (
            <div key={trip.id} className="border border-stone-200 rounded-xl overflow-hidden">
              {/* Collapsible trip header */}
              <button
                onClick={() => toggle(trip.id)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-stone-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2E442A15' }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color: '#2E442A' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-800 truncate text-sm">{trip.client_name}</p>
                  <p className="text-xs text-stone-500 truncate">
                    {trip.destination} • {formatDate(trip.start_date, 'd MMM', { locale: es })}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-lg flex-shrink-0"
                  style={{
                    color: isUrgent ? '#DC2626' : '#2E442A',
                    background: isUrgent ? 'rgba(220,38,38,0.08)' : '#2E442A12'
                  }}
                >
                  {daysLabel(daysUntil)}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: '#2E442A' }}>
                  {pending.length}
                </span>
                {isOpen
                  ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-stone-400" />
                  : <ChevronDown className="w-4 h-4 flex-shrink-0 text-stone-400" />}
              </button>

              {/* Expanded reminders, grouped by stage */}
              {isOpen && (
                <div className="px-3 pb-3 border-t border-stone-100">
                  {TIMELINE_ORDER.map(period => {
                    const items = pending.filter(r => r.timeline_period === period);
                    if (items.length === 0) return null;
                    return (
                      <div key={period} className="mt-3">
                        <p className="text-xs font-semibold mb-1.5" style={{ color: '#2E442A' }}>
                          {TIMELINE_REMINDERS[period]?.label || period}
                        </p>
                        <div className="space-y-1">
                          {items.map(reminder => (
                            <div key={reminder.id} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                              <Checkbox
                                checked={false}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateReminderMutation.mutate({
                                      id: reminder.id,
                                      data: { completed: true, completed_date: new Date().toISOString() }
                                    });
                                  }
                                }}
                                className="mt-0.5"
                              />
                              <p className="text-xs text-stone-700 flex-1">{reminder.task}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <Link
                    to={createPageUrl(`SoldTripDetail?id=${trip.id}`)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    style={{ color: '#2E442A' }}
                  >
                    Ver viaje
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
