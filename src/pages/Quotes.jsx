import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { daysBetween, dateForIndex } from '@/lib/quoteEngine';
import { Loader2, Plus, Calendar, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_META = {
  draft:    { label: 'Borrador',  cls: 'bg-stone-100 text-stone-600' },
  sent:     { label: 'Enviada',   cls: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'Aceptada',  cls: 'bg-green-50 text-green-600' },
  rejected: { label: 'Rechazada', cls: 'bg-red-50 text-red-600' },
};

export default function Quotes() {
  const { user } = useSpoofableUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', trip_name: '', start_date: '', end_date: '', pax: 2 });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes', email],
    queryFn: () => supabaseAPI.entities.Quote.filter({ created_by: email }),
    enabled: !!email,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => supabaseAPI.entities.Client.list(),
  });
  const clientName = (id) => clients.find(c => String(c.id) === String(id))?.name || 'Cliente';

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const quote = await supabaseAPI.entities.Quote.create({
        client_id: data.client_id,
        trip_name: data.trip_name,
        start_date: data.start_date,
        end_date: data.end_date,
        pax: Number(data.pax) || 1,
        version: 1,
        status: 'draft',
        created_by: email,
      });
      const n = daysBetween(data.start_date, data.end_date);
      const days = Array.from({ length: n }, (_, i) => ({
        quote_id: quote.id, day_index: i, date: dateForIndex(data.start_date, i), city: '', is_free: false,
      }));
      await supabaseAPI.entities.QuoteDay.bulkCreate(days);
      return quote;
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setOpen(false);
      navigate(createPageUrl(`QuoteEditor?id=${quote.id}`));
    },
    onError: (e) => toast.error(`No se pudo crear la cotización: ${e?.message || 'error'}`),
  });

  const save = () => {
    if (!form.client_id) { toast.error('Elige un cliente'); return; }
    if (!form.trip_name.trim()) { toast.error('Escribe el nombre del viaje'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Pon las fechas de salida y regreso'); return; }
    if (form.end_date < form.start_date) { toast.error('El regreso no puede ser antes de la salida'); return; }
    createMutation.mutate(form);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
               style={{ background: 'linear-gradient(135deg, var(--nomad-green-light) 0%, var(--nomad-green) 100%)' }}>
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'Playfair Display, serif' }}>Cotizaciones</h1>
            <p className="text-sm text-stone-500">Cotizador day-by-day</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ client_id: '', trip_name: '', start_date: '', end_date: '', pax: 2 }); setOpen(true); }}
          className="text-white rounded-xl self-start" style={{ backgroundColor: '#2E442A' }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva cotización
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-stone-400" /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
          <FileText className="w-12 h-12 mx-auto text-stone-200 mb-3" />
          <p className="text-stone-500">Sin cotizaciones todavía. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quotes.map(q => {
            const st = STATUS_META[q.status] || STATUS_META.draft;
            return (
              <button key={q.id} onClick={() => navigate(createPageUrl(`QuoteEditor?id=${q.id}`))}
                className="text-left bg-white rounded-2xl border border-stone-100 shadow-sm p-5 hover:shadow-md hover:border-stone-200 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-stone-800 truncate" style={{ fontFamily: 'Playfair Display, serif' }}>{q.trip_name || 'Sin nombre'}</h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 ${st.cls}`}>{st.label} · v{q.version}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-stone-500">
                  <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {clientName(q.client_id)}</p>
                  <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />
                    {q.start_date ? formatDate(q.start_date, 'd MMM', { locale: es }) : '—'}
                    {q.end_date ? ` – ${formatDate(q.end_date, 'd MMM yyyy', { locale: es })}` : ''}
                    {' · '}{q.pax} pax
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal nueva cotización */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#2E442A' }}>Nueva cotización</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Cliente</label>
              <Select value={form.client_id} onValueChange={(v) => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Elegir cliente…" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Nombre del viaje</label>
              <Input value={form.trip_name} onChange={(e) => setForm(f => ({ ...f, trip_name: e.target.value }))} placeholder="Ej. Canadá en otoño" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1 block">Salida</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1 block">Regreso</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Pasajeros</label>
              <Input type="number" min={1} value={form.pax} onChange={(e) => setForm(f => ({ ...f, pax: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={save} disabled={createMutation.isPending} className="text-white rounded-xl" style={{ backgroundColor: '#2E442A' }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear y abrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
