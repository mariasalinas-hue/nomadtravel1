import { useState, useMemo, useContext } from 'react';
import { supabaseAPI, supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { ViewModeContext } from '@/Layout';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { Sparkles, Send, Loader2, AlertTriangle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXAMPLES = [
  '¿Cuánto vendí este mes?',
  '¿Qué clientes viajan en diciembre?',
  '¿Qué clientes me deben (saldo por cobrar)?',
  '¿Cuál fue mi mejor mes de ventas?',
  '¿Cuántas cotizaciones tengo abiertas?',
  '¿A qué destinos he vendido más?',
];

export default function AskCrm() {
  const { viewMode, isActualAdmin } = useContext(ViewModeContext);
  const { user: clerkUser, isLoaded } = useSpoofableUser();

  const user = clerkUser ? {
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
  } : null;
  const isAdmin = isActualAdmin && viewMode === 'admin';
  const userLoading = !isLoaded;

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const { data: soldTrips = [] } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: () => (isAdmin ? supabaseAPI.entities.SoldTrip.list() : supabaseAPI.entities.SoldTrip.filter({ created_by: user.email })),
    enabled: !!user && !userLoading,
  });
  const { data: trips = [] } = useQuery({
    queryKey: ['trips', user?.email, isAdmin],
    queryFn: () => (isAdmin ? supabaseAPI.entities.Trip.list() : supabaseAPI.entities.Trip.filter({ created_by: user.email })),
    enabled: !!user && !userLoading,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.email, isAdmin],
    queryFn: () => (isAdmin ? supabaseAPI.entities.Client.list() : supabaseAPI.entities.Client.filter({ created_by: user.email })),
    enabled: !!user && !userLoading,
  });

  // Resumen compacto de datos que se manda a la IA (solo lo del agente)
  const context = useMemo(() => {
    const sum = (list, f) => Math.round(list.reduce((s, t) => s + (Number(f(t)) || 0), 0));
    return {
      agente: user?.full_name || null,
      es_vista_admin: isAdmin,
      fecha_de_hoy: new Date().toISOString().slice(0, 10),
      resumen: {
        viajes_vendidos: soldTrips.length,
        ventas_totales_usd: sum(soldTrips, t => t.total_price),
        comisiones_totales_usd: sum(soldTrips, t => t.total_commission),
        cotizaciones_totales: trips.length,
        clientes: clients.length,
      },
      viajes: soldTrips.slice(0, 250).map(t => ({
        cliente: t.client_name,
        destino: t.destination,
        vendido: t.created_date ? String(t.created_date).slice(0, 10) : null,
        viaje_inicio: t.start_date || null,
        viaje_fin: t.end_date || null,
        total_usd: Math.round(t.total_price || 0),
        comision_usd: Math.round(t.total_commission || 0),
        pagado_usd: Math.round(t.total_paid_by_client || 0),
        estatus: t.status || null,
      })),
      cotizaciones: trips.slice(0, 250).map(q => ({
        destino: q.destination,
        presupuesto_usd: q.budget || null,
        etapa: q.stage || null,
        creado: q.created_date ? String(q.created_date).slice(0, 10) : null,
      })),
    };
  }, [soldTrips, trips, clients, user, isAdmin]);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setQuestion(text);
    setAsking(true);
    setAnswer('');
    setErrMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('askCrm', { body: { question: text, context } });
      if (error) throw error;
      if (data?.answer) setAnswer(data.answer);
      else setErrMsg(data?.error || 'No recibí respuesta de la IA.');
    } catch (_e) {
      setErrMsg('No pude conectar con la IA. Revisa que la función "askCrm" esté desplegada en Supabase y que la llave OPENAI_API_KEY esté configurada.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-stone-800 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
          <Sparkles className="w-6 h-6" style={{ color: '#C9A84C' }} />
          Pregúntale a tu CRM
        </h1>
        <p className="text-stone-500 mt-1">
          Pregunta en español sobre tus ventas, viajes y clientes. La IA solo ve <strong>tus</strong> datos del CRM.
        </p>
      </div>

      {/* Caja de pregunta */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
            placeholder="Ej. ¿Cuánto vendí en julio y cuánto viaja en diciembre?"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          <Button onClick={() => ask()} disabled={asking || !question.trim()} className="rounded-xl text-white h-10" style={{ backgroundColor: '#2E442A' }}>
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Ejemplos */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            <Lightbulb className="w-3.5 h-3.5" /> Ejemplos
          </span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => ask(ex)} disabled={asking}
              className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Respuesta */}
      {asking && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 flex items-center gap-3 text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2E442A' }} /> Pensando…
        </div>
      )}

      {!asking && answer && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: '#C9A84C' }} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Respuesta</span>
          </div>
          <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}

      {!asking && errMsg && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">IA no disponible</p>
            <p className="text-xs text-amber-700 mt-0.5">{errMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
