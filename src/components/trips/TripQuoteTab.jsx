import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { daysBetween, dateForIndex } from '@/lib/quoteEngine';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import QuoteEditor from '@/pages/QuoteEditor';

// Pestaña "Cotización" dentro del viaje: una cotización por viaje. Si no existe,
// la crea con los datos del viaje y luego embebe el cotizador día-por-día.
export default function TripQuoteTab({ trip }) {
  const { user } = useSpoofableUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const [creating, setCreating] = useState(false);

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ['tripQuote', trip.id],
    queryFn: async () => {
      const rows = await supabaseAPI.entities.Quote.filter({ trip_id: trip.id });
      return rows[0] || null;
    },
    enabled: !!trip.id,
    refetchOnWindowFocus: false,
  });

  const createQuote = async () => {
    setCreating(true);
    try {
      const start = trip.start_date || null;
      const end = trip.end_date || start;
      const q = await supabaseAPI.entities.Quote.create({
        client_id: trip.client_id,
        trip_id: trip.id,
        trip_name: trip.trip_name || trip.destination || 'Cotización',
        start_date: start,
        end_date: end,
        pax: Number(trip.travelers) || 2,
        version: 1,
        status: 'draft',
        created_by: email,
      });
      if (start && end) {
        const n = daysBetween(start, end);
        const days = Array.from({ length: n }, (_, i) => ({
          quote_id: q.id, day_index: i, date: dateForIndex(start, i), city: '', is_free: false,
        }));
        await supabaseAPI.entities.QuoteDay.bulkCreate(days);
      }
      await refetch();
    } catch (e) {
      toast.error(`No se pudo crear la cotización: ${e?.message || 'error'}`);
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2E442A' }} /></div>;
  }

  if (!quote) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
        <p className="text-stone-500 mb-4">Este viaje todavía no tiene cotización.</p>
        <button onClick={createQuote} disabled={creating}
          className="inline-flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: '#2E442A' }}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear cotización
        </button>
      </div>
    );
  }

  return <QuoteEditor quoteId={quote.id} embedded />;
}
