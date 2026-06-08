import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAPI } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, CheckCircle, Plane } from 'lucide-react';
import { toast } from 'sonner';

const TRIP_TYPES = [
  { value: 'Romántico / Luna de miel', emoji: '💕' },
  { value: 'Familiar', emoji: '👨‍👩‍👧' },
  { value: 'Amigos', emoji: '👯' },
  { value: 'Aventura', emoji: '🏔️' },
  { value: 'Relax / Playa', emoji: '🏖️' },
  { value: 'Otro', emoji: '✨' }
];

export default function TripRequestForm() {
  const { clientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    destination: '',
    trip_type: '',
    travelers: '',
    month: '',
    flexible: false,
    nights: '',
    budget: '',
    notes: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await supabaseAPI.entities.Client.filter({ id: clientId });
        if (res && res.length > 0) setClient(res[0]);
      } catch (error) {
        console.error('Error loading client:', error);
      } finally {
        setLoading(false);
      }
    };
    if (clientId) load();
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destination && !form.trip_type) {
      toast.error('Cuéntanos al menos a dónde o qué tipo de viaje buscas');
      return;
    }

    setSubmitting(true);
    try {
      const notesParts = [];
      if (form.nights) notesParts.push(`Duración aprox: ${form.nights} noches`);
      if (form.flexible) notesParts.push('Fechas flexibles');
      if (form.notes) notesParts.push(form.notes);

      await supabaseAPI.entities.Trip.create({
        client_id: clientId,
        client_name: `${client.first_name} ${client.last_name || ''}`.trim(),
        created_by: client.created_by,
        destination: form.destination || 'Por definir',
        trip_name: form.destination ? `Cotización ${form.destination}` : 'Cotización',
        mood: form.trip_type,
        travelers: form.travelers,
        start_date: form.month ? `${form.month}-01` : null,
        budget: form.budget ? parseFloat(form.budget) : null,
        stage: 'nuevo',
        notes: notesParts.join(' · ')
      });

      setSubmitted(true);
      toast.success('¡Formulario enviado!');
    } catch (error) {
      console.error('Error submitting trip request:', error);
      toast.error('Error al enviar. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-stone-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">Link Inválido</h1>
          <p className="text-stone-600">Este link no es válido. Por favor contacta a tu agente de viajes.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#2E442A' }}>
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">¡Gracias!</h1>
          <p className="text-stone-600">Recibimos los detalles de tu viaje. Tu agente se pondrá en contacto contigo muy pronto. ✈️</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-stone-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#2E442A' }}>
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-800">Hola {client.first_name}, cuéntanos sobre tu viaje</h1>
            </div>
          </div>
          <p className="text-stone-600">
            Son datos <strong>aproximados</strong> para empezar — los afinamos juntos después. ✨
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Destination */}
          <div className="space-y-2">
            <Label htmlFor="destination">¿A dónde te gustaría ir?</Label>
            <Input
              id="destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: Italia y Grecia (o 'aún no lo sé')"
            />
          </div>

          {/* Trip type */}
          <div className="space-y-2">
            <Label>¿Qué tipo de viaje buscas?</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRIP_TYPES.map(t => {
                const selected = form.trip_type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm({ ...form, trip_type: selected ? '' : t.value })}
                    className="rounded-xl border p-3 text-sm text-left transition-colors"
                    style={{
                      borderColor: selected ? '#2E442A' : 'rgba(0,0,0,0.1)',
                      background: selected ? '#2E442A12' : 'white',
                      color: selected ? '#2E442A' : '#44403C',
                      fontWeight: selected ? 600 : 400
                    }}
                  >
                    <span className="mr-1">{t.emoji}</span>{t.value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Travelers */}
          <div className="space-y-2">
            <Label htmlFor="travelers">¿Cuántas personas viajan?</Label>
            <Input
              id="travelers"
              value={form.travelers}
              onChange={(e) => setForm({ ...form, travelers: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: 2 adultos, o 2 adultos + 1 niño"
            />
          </div>

          {/* When */}
          <div className="space-y-2">
            <Label htmlFor="month">¿Cuándo, más o menos?</Label>
            <Input
              id="month"
              type="month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="rounded-xl"
            />
            <label className="flex items-center gap-2 text-sm text-stone-600 mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.flexible}
                onChange={(e) => setForm({ ...form, flexible: e.target.checked })}
                className="rounded"
              />
              Mis fechas son flexibles
            </label>
          </div>

          {/* Nights */}
          <div className="space-y-2">
            <Label htmlFor="nights">¿Cuántas noches, más o menos?</Label>
            <Input
              id="nights"
              type="number"
              min="0"
              value={form.nights}
              onChange={(e) => setForm({ ...form, nights: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: 7"
            />
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label htmlFor="budget">Presupuesto total aproximado (USD)</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: 8000"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">¿Algo más que debamos saber? (opcional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="rounded-xl resize-none"
              placeholder="Ocasión especial, preferencias, etc."
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl text-white text-lg py-6"
            style={{ backgroundColor: '#2E442A' }}
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enviando...</>
            ) : (
              <><CheckCircle className="w-5 h-5 mr-2" />Enviar</>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
