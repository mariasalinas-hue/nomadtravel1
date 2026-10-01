import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAPI } from '@/api/supabaseClient';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { money, totals, hotelCover, resolveOptions, groupServices, SERVICE_TYPES } from '@/lib/quoteEngine';
import { Hotel, Plane, Compass, Car, Train, Package, Ship, Briefcase, Loader2, MapPin, Users, Calendar } from 'lucide-react';

const TYPE_ICON = { hotel: Hotel, vuelo: Plane, crucero: Ship, tour: Compass, traslado: Car, tren: Train, dmc: Briefcase, otro: Package };

// Subtítulo discreto por tipo (nunca muestra proveedor ni datos internos).
function serviceSubtitle(s) {
  const m = s.meta || {};
  if (s.type === 'hotel') {
    const parts = [];
    if (s.nights) parts.push(`${s.nights} noche${s.nights > 1 ? 's' : ''}`);
    if (m.room_type) parts.push(m.room_type);
    if (s.breakfast) parts.push('con desayuno');
    return parts.join(' · ');
  }
  if (s.type === 'vuelo') return [m.airline, m.route, m.flight_class].filter(Boolean).join(' · ');
  if (s.type === 'crucero') return [m.cruise_line, m.cruise_ship, m.cruise_cabin_type].filter(Boolean).join(' · ');
  return '';
}

// Tarjeta de un servicio en la vista del cliente (foto, nombre, descripción, precio).
function ServiceArticle({ s }) {
  const Icon = TYPE_ICON[s.type] || Package;
  const subtitle = serviceSubtitle(s);
  return (
    <article className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {s.meta?.image_url && <img src={s.meta.image_url} alt="" className="w-full h-44 object-cover" />}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#2E442A0F' }}>
            <Icon className="w-4 h-4" style={{ color: '#2E442A' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-stone-400">{SERVICE_TYPES[s.type]?.label || s.type}</p>
            <h3 className="text-base font-semibold text-stone-800">{s.name || SERVICE_TYPES[s.type]?.label}</h3>
            {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          {Number(s.gross) > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-base font-bold tabular-nums" style={{ color: '#2E442A' }}>{money(s.gross)}</p>
              <p className="text-[10px] text-stone-400">USD</p>
            </div>
          )}
        </div>
        {s.description && <p className="text-sm text-stone-600 leading-relaxed mt-3 whitespace-pre-line">{s.description}</p>}
      </div>
    </article>
  );
}

export default function PublicQuote() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(null);
  const [days, setDays] = useState([]);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await supabaseAPI.entities.Quote.filter({ public_token: token });
        const q = rows[0];
        if (!q) { if (alive) { setQuote(null); setLoading(false); } return; }

        const dayRows = await supabaseAPI.entities.QuoteDay.filter({ quote_id: q.id });
        const ids = dayRows.map(d => d.id);
        let services = [];
        if (ids.length) {
          const all = await supabaseAPI.entities.QuoteService.list();
          services = all.filter(s => ids.includes(s.quote_day_id));
        }
        const assembled = [...dayRows].sort((a, b) => a.day_index - b.day_index).map(d => ({
          ...d,
          services: services.filter(s => s.quote_day_id === d.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        }));

        let name = '';
        if (q.client_id) {
          try {
            const c = (await supabaseAPI.entities.Client.filter({ id: q.client_id }))[0];
            name = c?.name || [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || '';
          } catch { /* opcional */ }
        }

        if (alive) { setQuote(q); setDays(assembled); setClientName(name); setLoading(false); }
      } catch {
        if (alive) { setQuote(null); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} /></div>;
  }
  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6 text-center">
        <div>
          <p className="text-lg font-medium text-stone-700">Cotización no disponible</p>
          <p className="text-sm text-stone-500 mt-1">Es posible que el link sea incorrecto o haya expirado.</p>
        </div>
      </div>
    );
  }

  const calcDays = resolveOptions(days);
  const cover = hotelCover(calcDays);
  const t = totals(calcDays);
  const nights = Math.max(0, days.length - 1);

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap');`}</style>

      {/* Portada */}
      <header className="relative">
        {quote.cover_image_url ? (
          <div className="h-64 md:h-80 w-full overflow-hidden">
            <img src={quote.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(46,68,42,0.85), rgba(46,68,42,0.15))' }} />
          </div>
        ) : (
          <div className="h-40 md:h-52 w-full" style={{ background: 'linear-gradient(135deg, #2E442A, #3f6b58)' }} />
        )}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 md:px-10 md:pb-8">
          <div className="max-w-3xl mx-auto">
            <p className="text-white/80 text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Nomad Travel</p>
            <h1 className="text-white text-3xl md:text-5xl font-bold leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              {quote.trip_name || 'Tu viaje'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-10 py-8" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Meta */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600 border-b border-stone-200 pb-5 mb-6">
          {clientName && <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-[#C9A84C]" /> {clientName}</span>}
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-[#C9A84C]" />
            {quote.start_date ? formatDate(quote.start_date, "d MMM", { locale: es }) : ''}
            {quote.end_date ? ` – ${formatDate(quote.end_date, "d MMM yyyy", { locale: es })}` : ''}
          </span>
          <span>{days.length} días · {nights} noches</span>
          {quote.pax ? <span>{quote.pax} viajeros</span> : null}
        </div>

        {/* Nota de bienvenida */}
        {quote.cover_note && (
          <p className="text-stone-600 leading-relaxed whitespace-pre-line mb-8">{quote.cover_note}</p>
        )}

        {/* Itinerario día por día */}
        <div className="space-y-6">
          {days.map((d, i) => {
            const cov = cover[i];
            return (
              <section key={d.id} className="relative">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C9A84C]">Día {i + 1}</span>
                  <span className="text-sm text-stone-400">{d.date ? formatDate(d.date, "EEEE d 'de' MMMM", { locale: es }) : ''}</span>
                </div>
                {d.city && <p className="flex items-center gap-1.5 text-lg font-semibold text-stone-800 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}><MapPin className="w-4 h-4 text-stone-400" /> {d.city}</p>}

                {d.is_free && !d.services.length && !cov && (
                  <p className="text-sm text-stone-400 italic">Día libre para disfrutar a tu ritmo.</p>
                )}

                {cov && (
                  <p className="text-sm text-stone-400 mb-3 flex items-center gap-1.5">
                    <Hotel className="w-3.5 h-3.5" /> Continúas hospedado en {cov.service.name || 'tu hotel'} (noche {cov.night} de {cov.of}).
                  </p>
                )}

                {(() => {
                  const { singles, groups } = groupServices(d.services);
                  return (
                    <div className="space-y-3">
                      {singles.map((s) => <ServiceArticle key={s.id} s={s} />)}
                      {groups.map((g) => (
                        <div key={g.option_group} className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2 px-1">Elige una opción</p>
                          <div className="space-y-3">
                            {g.services.map((s) => (
                              <div key={s.id} className="relative">
                                {s.is_selected && (
                                  <span className="absolute z-10 top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: '#C9A84C' }}>Recomendada</span>
                                )}
                                <ServiceArticle s={s} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            );
          })}
        </div>

        {/* Total */}
        <div className="mt-10 rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #2E442A, #3f6b58)' }}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/70 text-sm">Inversión total del viaje</p>
              <p className="text-white/60 text-xs mt-1">{quote.pax ? `${quote.pax} viajeros · ${money(t.sum / quote.pax)} por persona` : ''}</p>
            </div>
            <p className="text-3xl md:text-4xl font-bold tabular-nums" style={{ fontFamily: 'Playfair Display, serif' }}>{money(t.sum)} <span className="text-lg font-medium">USD</span></p>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 mt-8">
          Cotización preparada por Nomad Travel · Precios sujetos a disponibilidad al momento de confirmar.
        </p>
      </main>
    </div>
  );
}
