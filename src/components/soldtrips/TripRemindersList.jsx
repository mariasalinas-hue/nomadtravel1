import React, { useEffect } from 'react';
import { differenceInMonths, differenceInWeeks, differenceInDays, differenceInHours } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { parseLocalDate } from '@/components/utils/dateHelpers';
import { TIMELINE_REMINDERS } from '@/components/utils/reminderTemplate';

export default function TripRemindersList({ startDate, reminders = [], onCreate, onUpdate }) {
  const tripDate = parseLocalDate(startDate);
  const now = new Date();

  // Initialize reminders if empty
  useEffect(() => {
    if (reminders.length === 0) {
      const allReminders = [];
      Object.entries(TIMELINE_REMINDERS).forEach(([period, info]) => {
        info.tasks.forEach(task => {
          allReminders.push({
            timeline_period: period,
            task: task
          });
        });
      });
      
      if (allReminders.length > 0) {
        onCreate(allReminders);
      }
    }
  }, [reminders.length]);

  const getTimelineStatus = (period) => {
    const monthsUntil = differenceInMonths(tripDate, now);
    const weeksUntil = differenceInWeeks(tripDate, now);
    const daysUntil = differenceInDays(tripDate, now);
    const hoursUntil = differenceInHours(tripDate, now);

    switch (period) {
      case '6_months':
        return monthsUntil >= 6 ? 'upcoming' : 'active';
      case '3_months':
        return monthsUntil >= 3 ? (monthsUntil >= 6 ? 'upcoming' : 'active') : 'past';
      case '1.5_months':
        return monthsUntil >= 1.5 ? (monthsUntil >= 3 ? 'upcoming' : 'active') : 'past';
      case '1_month':
        return monthsUntil >= 1 ? (monthsUntil >= 1.5 ? 'upcoming' : 'active') : 'past';
      case '3_weeks':
        return weeksUntil >= 3 ? (monthsUntil >= 1 ? 'upcoming' : 'active') : 'past';
      case '1-2_weeks':
        return weeksUntil >= 1 && weeksUntil <= 2 ? 'active' : (weeksUntil > 2 ? 'upcoming' : 'past');
      case '72-48_hours':
        return hoursUntil >= 48 && hoursUntil <= 72 ? 'active' : (hoursUntil > 72 ? 'upcoming' : 'past');
      case '24_hours':
        return hoursUntil <= 24 && hoursUntil > 0 ? 'active' : (hoursUntil > 24 ? 'upcoming' : 'past');
      default:
        return 'upcoming';
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(TIMELINE_REMINDERS).map(([period, info]) => {
        const periodReminders = reminders.filter(r => r.timeline_period === period);
        const status = getTimelineStatus(period);
        const completedCount = periodReminders.filter(r => r.completed).length;
        const totalCount = info.tasks.length;

        return (
          <div key={period} className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className={`
                ${status === 'active' ? 'bg-blue-500 text-white' : 
                  status === 'past' ? 'bg-stone-300 text-stone-600' : 
                  'bg-stone-100 text-stone-500'}
              `}>
                {info.label}
              </Badge>
              {periodReminders.length > 0 && (
                <span className="text-xs text-stone-500">
                  {completedCount} / {totalCount} completado
                </span>
              )}
            </div>

            <div className="space-y-2 ml-4">
              {info.tasks.map((task, index) => {
                const reminder = periodReminders.find(r => r.task === task);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-3 rounded-lg border transition-all ${
                      reminder?.completed
                        ? 'bg-green-50 border-green-200'
                        : status === 'active'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={reminder?.completed || false}
                        onCheckedChange={(checked) => {
                          if (reminder) {
                            onUpdate(reminder.id, { 
                              completed: checked,
                              completed_date: checked ? new Date().toISOString() : null
                            });
                          }
                        }}
                        disabled={!reminder}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${reminder?.completed ? 'line-through text-stone-500' : 'text-stone-700'}`}>
                          {task}
                        </p>
                        {status === 'active' && !reminder?.completed && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3 text-blue-600" />
                            <span className="text-xs text-blue-600 font-medium">Pendiente</span>
                          </div>
                        )}
                      </div>
                      {reminder?.completed && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}