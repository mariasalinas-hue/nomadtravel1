import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, X, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Comparte un viaje con colaboradores (por correo). Los correos se guardan en
 * soldTrip.metadata.shared_with. Quien esté ahí verá el viaje en su Corsario y
 * podrá verlo y editarlo con su propia cuenta.
 */
export default function ShareTripModal({ open, onClose, soldTrip, onSave, isLoading }) {
  const [emails, setEmails] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (open) {
      const current = soldTrip?.metadata?.shared_with;
      setEmails(Array.isArray(current) ? current : []);
      setInput('');
    }
  }, [open, soldTrip]);

  const ownerEmail = (soldTrip?.created_by || '').toLowerCase();

  const addEmail = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) { toast.error('Correo no válido'); return; }
    if (email === ownerEmail) { toast.error('Ese es el dueño del viaje'); return; }
    if (emails.includes(email)) { toast.error('Ya está agregado'); return; }
    setEmails([...emails, email]);
    setInput('');
  };

  const removeEmail = (email) => setEmails(emails.filter(e => e !== email));

  const handleSave = () => onSave(emails);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: '#2E442A' }}>
            <Users className="w-5 h-5" /> Compartir viaje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-stone-500">
            Agrega el correo de quien quieras que colabore. Verá este viaje en su Corsario y podrá <strong>verlo y editarlo</strong> desde su propia cuenta.
          </p>

          <div className="space-y-2">
            <Label className="text-xs text-stone-500">Correo del colaborador</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  type="email"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                  placeholder="asistente@correo.com"
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button type="button" onClick={addEmail} variant="outline" className="rounded-xl">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-stone-500">Con acceso ({emails.length})</Label>
            <div className="mt-2 flex flex-wrap gap-2 min-h-[40px]">
              {emails.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Aún no compartido con nadie</p>
              ) : emails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5">
                  {email}
                  <button type="button" onClick={() => removeEmail(email)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading} className="rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
