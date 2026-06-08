import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseAPI } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, CheckCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientIntakeForm() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [agentInfo, setAgentInfo] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: ''
  });

  // Validate token and get agent info (reuses the shared-form mechanism)
  useEffect(() => {
    const validateToken = async () => {
      try {
        setLoading(true);
        const sharedForms = await supabaseAPI.entities.SharedTripForm.filter({ share_token: token });

        if (sharedForms && sharedForms.length > 0) {
          const sharedForm = sharedForms[0];
          if (sharedForm.is_active && (!sharedForm.expires_at || new Date(sharedForm.expires_at) > new Date())) {
            setValidToken(true);
            setAgentInfo({ name: sharedForm.agent_name, email: sharedForm.agent_email });
          } else {
            toast.error('Este link ya no está activo o ha expirado');
          }
        } else {
          toast.error('Link inválido');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        toast.error('Error al validar el link');
      } finally {
        setLoading(false);
      }
    };

    if (token) validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      toast.error('Por favor ingresa tu nombre');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Por favor ingresa tu correo electrónico');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        birth_date: formData.birth_date || null
      };

      // If this agent already has a client with that email, update it; otherwise create new
      const existing = await supabaseAPI.entities.Client.filter({
        email: payload.email,
        created_by: agentInfo.email
      });

      if (existing && existing.length > 0) {
        await supabaseAPI.entities.Client.update(existing[0].id, payload);
      } else {
        await supabaseAPI.entities.Client.create({
          ...payload,
          created_by: agentInfo.email,
          source: 'Formulario compartido'
        });
      }

      setSubmitted(true);
      toast.success('¡Datos enviados exitosamente!');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error al enviar el formulario. Por favor intenta de nuevo.');
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

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">Link Inválido</h1>
          <p className="text-stone-600">
            Este link no es válido o ha expirado. Por favor contacta a tu agente de viajes.
          </p>
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
          <h1 className="text-2xl font-bold text-stone-800 mb-2">¡Datos Recibidos!</h1>
          <p className="text-stone-600">
            Gracias. {agentInfo?.name || 'Tu agente'} ya tiene tu información y se pondrá en
            contacto contigo pronto.
          </p>
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
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-800">Tus datos de contacto</h1>
              <p className="text-sm text-stone-600">
                Agente: <strong>{agentInfo?.name}</strong>
              </p>
            </div>
          </div>
          <p className="text-stone-600">
            Completa tus datos para que tu agente pueda atenderte mejor.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre <span className="text-red-500">*</span></Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="rounded-xl"
                placeholder="Ej: Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="rounded-xl"
                placeholder="Ej: Pérez"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico <span className="text-red-500">*</span></Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="rounded-xl"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="rounded-xl"
              placeholder="+52 123 456 7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              className="rounded-xl"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl text-white text-lg py-6 mt-6"
            style={{ backgroundColor: '#2E442A' }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Enviar mis datos
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
