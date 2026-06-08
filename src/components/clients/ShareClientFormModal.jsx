import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Share2, ExternalLink, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseAPI } from '@/api/supabaseClient';
import { useSpoofableUser } from '@/contexts/SpoofContext';

export default function ShareClientFormModal({ open, onClose }) {
  const { user: clerkUser } = useSpoofableUser();
  const [shareLink, setShareLink] = useState('');
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
      const token = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await supabaseAPI.entities.SharedTripForm.create({
        share_token: token,
        agent_id: user.id,
        agent_email: user.email,
        agent_name: user.full_name,
        is_active: true,
        expires_at: null
      });

      const baseUrl = window.location.origin;
      setShareLink(`${baseUrl}/public/client-form/${token}`);
      toast.success('Link generado exitosamente');
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error('Error al generar el link');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareLink('');
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
            Genera un link para que tu cliente llene sus datos (nombre, email, teléfono y
            fecha de nacimiento). Se guardará automáticamente en tu lista de clientes.
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
              <div className="space-y-2">
                <Label htmlFor="client-share-link">Link para compartir</Label>
                <div className="flex gap-2">
                  <Input
                    id="client-share-link"
                    value={shareLink}
                    readOnly
                    className="rounded-xl font-mono text-sm"
                    onClick={(e) => e.target.select()}
                  />
                  <Button onClick={copyToClipboard} variant="outline" className="rounded-xl flex-shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

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
                  Generar nuevo
                </Button>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Compártelo por WhatsApp, email o donde quieras. No expira.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
