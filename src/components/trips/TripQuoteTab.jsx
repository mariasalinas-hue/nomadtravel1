import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { daysBetween, dateForIndex } from '@/lib/quoteEngine';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import QuoteEditor from '@/pages/QuoteEditor';
import QuoteSummaryCard from './QuoteSummaryCard';

// Pestaña "Cotización" del viaje: lista de cotizaciones (recuadros con resumen) +
// botón "Nueva cotización" que abre el cotizador completo en un popup. Varias por viaje.
export default function TripQuoteTab({ trip }) {
  const { user } = useSpoofableUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: ['tripQuotes', trip.id],
    queryFn: () => supabaseAPI.entities.Quote.filter({ trip_id: trip.id }),
    enabled: !!trip.id,
    refetchOnWindowFocus: false,
  });

  const createQuote = async () => {
    setCreating(true);
    try {
      const start = trip.start_date || null;
      const end = trip.end_date || start;
      const nextVersion = quotes.reduce((m, q) => Math.max(m, q.version || 1), 0) + 1;
      const q = await supabaseAPI.entities.Quote.create({
        client_id: trip.client_id,
        trip_id: trip.id,
        trip_name: trip.trip_name || trip.destination || 'Cotización',
        start_date: start,
        end_date: end,
        pax: Number(trip.travelers) || 2,
        version: nextVersion,
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
      setOpenId(q.id);
    } catch (e) {
      toast.error(`No se pudo crear la cotización: ${e?.message || 'error'}`);
    } finally {
      setCreating(false);
    }
  };

  const removeQuote = async (q) => {
    if (!window.confirm('¿Eliminar esta cotización?')) return;
    try { await supabaseAPI.entities.Quote.delete(q.id); await refetch(); }
    catch (e) { toast.error(`No se pudo eliminar: ${e?.message || 'error'}`); }
  };

  const closeModal = () => {
    if (openId) queryClient.invalidateQueries({ queryKey: ['quoteSummary', openId] });
    setOpenId(null);
    refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-stone-500">{quotes.length} cotización{quotes.length === 1 ? '' : 'es'}</p>
        <button onClick={createQuote} disabled={creating}
          className="inline-flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60" style={{ backgroundColor: '#2E442A' }}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nueva cotización
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: '#2E442A' }} /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
          <p className="text-stone-500">Este viaje todavía no tiene cotizaciones.</p>
          <p className="text-xs text-stone-400 mt-1">Dale a "Nueva cotización" para empezar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {quotes.map(q => <QuoteSummaryCard key={q.id} quote={q} onOpen={() => setOpenId(q.id)} onDelete={removeQuote} />)}
        </div>
      )}

      {/* Popup con el cotizador completo */}
      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden">
          <div className="h-full overflow-auto p-5">
            {openId && <QuoteEditor quoteId={openId} embedded />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
