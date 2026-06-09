import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, ExternalLink, Plane } from 'lucide-react';
import { toast } from 'sonner';
import { PUBLIC_BASE_URL } from '@/lib/publicUrl';

export default function SendTripFormModal({ open, onClose, client }) {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const link = client ? `${PUBLIC_BASE_URL}/t/${client.id}` : '';
  const firstName = client?.first_name || '';

  useEffect(() => {
    if (open && client) {
      setMessage(`¡Hola ${firstName}! 🙏 Para empezar a planear tu viaje, cuéntanos cómo lo imaginas (a dónde, cuándo y cuánto). Es rápido:`);
      setCopied(false);
    }
  }, [open, client, firstName]);

  const copyMessageAndLink = () => {
    navigator.clipboard.writeText(`${message}\n\n${link}`);
    setCopied(true);
    toast.success('Mensaje y link copiados');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#2E442A' }}>
            <Plane className="w-5 h-5" />
            Enviar Formulario de Viaje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-stone-600">
            Manda este link a <strong>{client?.first_name} {client?.last_name}</strong> para que cuente
            cómo, cuándo y cuánto quiere gastar. Se creará una cotización ligada a este cliente.
          </p>

          <div className="space-y-2">
            <Label htmlFor="trip-msg">Mensaje (puedes editarlo)</Label>
            <Textarea
              id="trip-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="rounded-xl text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-link">Link</Label>
            <Input id="trip-link" value={link} readOnly className="rounded-xl font-mono text-sm" onClick={(e) => e.target.select()} />
          </div>

          <Button onClick={copyMessageAndLink} className="w-full rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copiado' : 'Copiar mensaje + link'}
          </Button>

          <Button onClick={() => window.open(link, '_blank')} variant="outline" className="w-full rounded-xl">
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver formulario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
