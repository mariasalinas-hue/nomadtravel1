import { useState } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

// Comparte la cotización con el cliente: link público + WhatsApp.
// El link muestra SOLO el precio al cliente (nunca neto ni comisión).
export default function ShareQuoteDialog({ open, onOpenChange, quote, clientName, onSent }) {
  const [copied, setCopied] = useState(false);
  const url = quote?.public_token
    ? `${window.location.origin}/public/quote/${quote.public_token}`
    : '';

  const waText = encodeURIComponent(
    `¡Hola${clientName ? ` ${clientName}` : ''}! Aquí está tu cotización de viaje${quote?.trip_name ? ` "${quote.trip_name}"` : ''}: ${url}`
  );

  const markSent = () => {
    if (quote?.status === 'draft') {
      supabaseAPI.entities.Quote.update(quote.id, { status: 'sent', published_at: new Date().toISOString() })
        .then(() => onSent?.())
        .catch(() => {});
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      markSent();
    } catch { toast.error('No se pudo copiar'); }
  };

  const openWhats = () => { window.open(`https://wa.me/?text=${waText}`, '_blank'); markSent(); };
  const openPreview = () => { window.open(url, '_blank'); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Playfair Display, serif', color: '#2E442A' }}>Compartir cotización</DialogTitle>
        </DialogHeader>

        {!url ? (
          <p className="text-sm text-stone-500 py-4">
            Esta cotización todavía no tiene link público. Corre la migración de Supabase
            <code className="mx-1 px-1 rounded bg-stone-100">quote_client_view</code> y vuelve a abrir.
          </p>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-stone-500">
              El cliente verá el itinerario día por día con fotos y el precio final. No se muestra el neto ni tu comisión.
            </p>

            <div className="flex gap-2">
              <Input readOnly value={url} className="text-xs text-stone-600" onFocus={(e) => e.target.select()} />
              <Button onClick={copy} variant="outline" className="flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={openWhats} className="w-full" style={{ backgroundColor: '#25D366' }}>
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button onClick={openPreview} variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" /> Vista previa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
