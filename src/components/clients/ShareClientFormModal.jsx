import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Share2, ExternalLink, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseAPI } from '@/api/supabaseClient';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { PUBLIC_BASE_URL } from '@/lib/publicUrl';

const DEFAULT_MESSAGE = '¡Hola! 🙏 Gracias por confiar en nosotros. Por favor llena tus datos en el siguiente formulario para agregarte a nuestro sistema y poder cotizarte:';

export default function ShareClientFormModal({ open, onClose }) {
  const { user: clerkUser } = useSpoofableUser();
  const [shareLink, setShareLink] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
  } : null;

  const generateShareLink = async () => {
    if (!user) {
      toast.error('Debes estar autenticado');
      return;
    }

    setIsGenerating(true);
    try {
      // Short, unique-enough token
      const token = (Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6));

      await supabaseAPI.entities.SharedTripForm.create({
        share_token: token,
        agent_id: user.id,
        agent_email: user.email,
        agent_name: user.full_name,
        is_active: true,
        expires_at: null
      });

      setShareLink(`${PUBLIC_BASE_URL}/c/${token}`);
      toast.success('Link generado exitosamente');
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('Error al generar el link');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyMessageAndLink = () => {
    const text = `${message}\n\n${shareLink}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Mensaje y link copiados');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareLink('');
    setMessage(DEFAULT_MESSAGE);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#2E442A' }}>
            <UserPlus className="w-5 h-5" />
            Compartir Formulario de Registro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-stone-600">
            Genera un link para que tu cliente llene sus datos. Se guardará automáticamente
            en tu lista de clientes.
          </p>

          {!shareLink ? (
            <Button
              onClick={generateShareLink}
              disabled={isGenerating}
              className="w-full rounded-xl text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generando link...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Generar Link
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Editable message */}
              <div className="space-y-2">
                <Label htmlFor="share-message">Mensaje (puedes editarlo)</Label>
                <Textarea
                  id="share-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="rounded-xl text-sm resize-none"
                />
              </div>

              {/* Link */}
              <div className="space-y-2">
                <Label htmlFor="client-share-link">Link</Label>
                <Input
                  id="client-share-link"
                  value={shareLink}
                  readOnly
                  className="rounded-xl font-mono text-sm"
                  onClick={(e) => e.target.select()}
                />
              </div>

              {/* Copy message + link (primary) */}
              <Button
                onClick={copyMessageAndLink}
                className="w-full rounded-xl text-white"
                style={{ backgroundColor: '#2E442A' }}
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copiado' : 'Copiar mensaje + link'}
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={() => window.open(shareLink, '_blank')}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </Button>
                <Button onClick={generateShareLink} variant="outline" className="flex-1 rounded-xl">
                  <Share2 className="w-4 h-4 mr-2" />
                  Nuevo link
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Pega el mensaje + link directo en WhatsApp o email. No expira.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
