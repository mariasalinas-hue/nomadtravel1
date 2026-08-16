import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Loader2, ArrowLeft, Plus, Eye, CheckCircle2, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GREEN = '#2E442A';

const STAGE_LABELS = {
  nuevo: 'Nuevo', cotizando: 'Cotizando', propuesta_enviada: 'Propuesta enviada',
  aceptado: 'Aceptado', vendido: 'Vendido', perdido: 'Perdido',
};

// Página del Cotizador — se abre a pantalla completa en una pestaña nueva,
// ligada al trip_id de la cotización del CRM. Esqueleto V1: el spreadsheet
// editable se construye en el siguiente paso.
export default function QuoteBuilder() {
  const tripId = new URLSearchParams(window.location.search).get('trip_id');

  const { data: trip, isLoading } = useQuery({
    queryKey: ['quote-trip', tripId],
    queryFn: () => supabaseAPI.entities.Trip.filter({ id: tripId }).then(r => r[0]),
    enabled: !!tripId,
  });

  if (!tripId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Falta el parámetro trip_id.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Cotización no encontrada.
      </div>
    );
  }

  const dates = [
    trip.start_date && formatDate(trip.start_date, 'd MMM', { locale: es }),
    trip.end_date && formatDate(trip.end_date, 'd MMM yyyy', { locale: es }),
  ].filter(Boolean).join(' – ');

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => window.close()} title="Cerrar pestaña">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-800 truncate">
                {trip.trip_name || trip.destination || 'Cotización'}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                {STAGE_LABELS[trip.stage] || trip.stage || '—'}
              </span>
            </div>
            <p className="text-xs text-stone-400 truncate">
              {trip.client_name}{trip.destination ? ` · ${trip.destination}` : ''}{dates ? ` · ${dates}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" disabled>
              <Plus className="w-4 h-4 mr-1.5" /> Agregar servicio
            </Button>
            <Button variant="outline" className="rounded-xl" disabled>
              <Eye className="w-4 h-4 mr-1.5" /> Preview cliente
            </Button>
            <Button className="rounded-xl text-white" style={{ backgroundColor: GREEN }} disabled>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Vender viaje
            </Button>
          </div>
        </div>
      </header>

      {/* Lienzo del cotizador (placeholder V1) */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-5 py-10">
          <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white p-14 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${GREEN}12` }}>
              <Table2 className="w-6 h-6" style={{ color: GREEN }} />
            </div>
            <h2 className="text-xl font-bold text-stone-800">Cotizador de viaje</h2>
            <p className="text-stone-500 mt-1 max-w-md mx-auto">
              Aquí va el spreadsheet editable del viaje (hoteles, vuelos, tours, traslados…).
              Ligado a esta cotización. Se construye en el siguiente paso.
            </p>
            <p className="text-xs text-stone-400 mt-4">Cotización #{trip.id}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
