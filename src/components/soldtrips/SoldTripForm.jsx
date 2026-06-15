import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CountryMultiSelect from '@/components/ui/CountryMultiSelect';

export default function SoldTripForm({ open, onClose, soldTrip, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    travelers: '',
    is_group_trip: false,
    group_split_method: 'equal',
    notes: ''
  });

  useEffect(() => {
    if (soldTrip && open) {
      setFormData({
        destination: soldTrip.destination || '',
        start_date: soldTrip.start_date || '',
        end_date: soldTrip.end_date || '',
        travelers: soldTrip.travelers || '',
        is_group_trip: soldTrip.is_group_trip || false,
        group_split_method: soldTrip.group_split_method || 'equal',
        notes: soldTrip.notes || ''
      });
    }
  }, [soldTrip, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.destination) {
      toast.error('Selecciona al menos un país de destino');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Viaje Vendido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <p className="text-sm font-medium text-stone-700">{soldTrip?.client_name}</p>
          </div>

          <div className="space-y-2">
            <Label>Destino (países) *</Label>
            <CountryMultiSelect
              value={formData.destination}
              onChange={(v) => setFormData({ ...formData, destination: v })}
              placeholder="Buscar y agregar países..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha Inicio *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha Fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="travelers">Número de Viajeros</Label>
            <Input
              id="travelers"
              type="text"
              value={formData.travelers}
              onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: 2 o 2 adultos + 1 niño"
            />
          </div>

          <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="group_trip"
                checked={formData.is_group_trip}
                onCheckedChange={(checked) => setFormData({...formData, is_group_trip: checked})}
              />
              <label htmlFor="group_trip" className="text-sm font-medium cursor-pointer">
                Este es un viaje grupal
              </label>
            </div>

            {formData.is_group_trip && (
              <div className="space-y-2 mt-3">
                <Label>Método de división de costos</Label>
                <Select
                  value={formData.group_split_method}
                  onValueChange={(value) => setFormData({...formData, group_split_method: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Igual entre todos</SelectItem>
                    <SelectItem value="percentage">Por porcentaje</SelectItem>
                    <SelectItem value="fixed">Montos fijos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-purple-700">
                  Podrás agregar los miembros del grupo en la pestaña "Miembros"
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="rounded-xl text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}