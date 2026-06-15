import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, ChevronDown, Search, Users } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from '@/lib/countries';

/**
 * Normaliza una fecha a formato YYYY-MM-DD sin conversiones de timezone.
 * Evita el bug del día corrido.
 */
function normalizeDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

const STAGES = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'cotizando', label: 'Cotizando' },
  { value: 'propuesta_enviada', label: 'Propuesta Enviada' },
  { value: 'aceptado', label: 'Aceptado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'perdido', label: 'Perdido' }
];

// Parsea la lista de clientes desde un trip existente
function parseExistingClients(trip, clients) {
  if (!trip) return [];
  // Si tiene metadata.clients (nuevo formato)
  if (trip.metadata?.clients?.length) return trip.metadata.clients;
  // Si tiene metadata.client_ids (formato intermedio)
  if (trip.metadata?.client_ids?.length) {
    return trip.metadata.client_ids.map(id => {
      const c = clients.find(cl => cl.id === id);
      return c ? { id: c.id, name: `${c.first_name} ${c.last_name}` } : null;
    }).filter(Boolean);
  }
  // Fallback: cliente único
  if (trip.client_id) {
    const c = clients.find(cl => cl.id === trip.client_id);
    const name = c ? `${c.first_name} ${c.last_name}` : trip.client_name || '';
    return [{ id: trip.client_id, name }];
  }
  return [];
}

export default function TripForm({ open, onClose, trip, clients = [], onSave, isLoading, prefilledClient }) {
  const [formData, setFormData] = useState({
    trip_name: '',
    selectedClients: [], // [{id, name}]
    destination: '',
    start_date: '',
    end_date: '',
    travelers: 1,
    budget: '',
    mood: '',
    stage: 'nuevo',
    notes: '',
    lost_reason: ''
  });

  const [destinationSearch, setDestinationSearch] = useState('');
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  // Lista de países integrada (sin depender de APIs externas)
  const countries = COUNTRIES;
  const loadingCountries = false;
  const destinationInputRef = useRef(null);

  // Estado para el buscador de clientes
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef(null);

  useEffect(() => {
    if (trip) {
      setFormData({
        trip_name: trip.trip_name || '',
        selectedClients: parseExistingClients(trip, clients),
        destination: trip.destination || '',
        start_date: normalizeDateOnly(trip.start_date),
        end_date: normalizeDateOnly(trip.end_date),
        travelers: trip.travelers || 1,
        budget: trip.budget || '',
        mood: trip.mood || '',
        stage: trip.stage || 'nuevo',
        notes: trip.notes || '',
        lost_reason: trip.lost_reason || ''
      });
      setDestinationSearch('');
      setClientSearch('');
    } else if (prefilledClient) {
      setFormData({
        trip_name: '',
        selectedClients: [{ id: prefilledClient.id, name: prefilledClient.name || '' }],
        destination: '',
        start_date: '',
        end_date: '',
        travelers: 1,
        budget: '',
        mood: '',
        stage: 'nuevo',
        notes: '',
        lost_reason: ''
      });
      setDestinationSearch('');
      setClientSearch('');
    } else {
      setFormData({
        trip_name: '',
        selectedClients: [],
        destination: '',
        start_date: '',
        end_date: '',
        travelers: 1,
        budget: '',
        mood: '',
        stage: 'nuevo',
        notes: '',
        lost_reason: ''
      });
      setDestinationSearch('');
      setClientSearch('');
    }
  }, [trip, open, prefilledClient]);

  // ── Clientes ─────────────────────────────────────────────────────────────
  const filteredClients = clients.filter(c => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const search = clientSearch.toLowerCase();
    return fullName.includes(search) &&
      !formData.selectedClients.some(sel => sel.id === c.id);
  });

  const handleAddClient = (client) => {
    const name = `${client.first_name} ${client.last_name}`;
    setFormData(prev => ({
      ...prev,
      selectedClients: [...prev.selectedClients, { id: client.id, name }]
    }));
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const handleRemoveClient = (clientId) => {
    setFormData(prev => ({
      ...prev,
      selectedClients: prev.selectedClients.filter(c => c.id !== clientId)
    }));
  };

  // ── Destinos ──────────────────────────────────────────────────────────────
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(destinationSearch.toLowerCase()) ||
    country.region.toLowerCase().includes(destinationSearch.toLowerCase()) ||
    country.subregion.toLowerCase().includes(destinationSearch.toLowerCase())
  );

  const handleCountrySelect = (countryName) => {
    let currentDests = formData.destination ? formData.destination.split(', ').filter(d => d) : [];
    if (!currentDests.includes(countryName)) {
      currentDests.push(countryName);
      setFormData({ ...formData, destination: currentDests.join(', ') });
    }
    setDestinationSearch('');
    setShowDestinationDropdown(false);
  };

  const handleDestinationInputChange = (e) => {
    setDestinationSearch(e.target.value);
    setShowDestinationDropdown(true);
  };

  const handleDestinationInputBlur = () => {
    setTimeout(() => {
      setShowDestinationDropdown(false);
      const validCountry = countries.find(c => c.name.toLowerCase() === destinationSearch.toLowerCase());
      if (destinationSearch && !validCountry) {
        setDestinationSearch('');
      }
    }, 200);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.selectedClients.length === 0) {
      alert('Por favor selecciona al menos un cliente');
      return;
    }
    if (!formData.destination) {
      alert('Por favor selecciona al menos un destino');
      return;
    }
    if (!formData.start_date) {
      alert('Por favor ingresa una fecha de inicio');
      return;
    }

    const primaryClient = formData.selectedClients[0];
    const clientNames = formData.selectedClients.map(c => c.name).join(', ');

    const cleanedData = {
      trip_name: formData.trip_name,
      client_id: primaryClient.id,
      client_name: clientNames,
      destination: formData.destination,
      start_date: formData.start_date,
      end_date: formData.end_date,
      travelers: formData.travelers,
      budget: formData.budget === '' ? null : formData.budget,
      mood: formData.mood,
      stage: formData.stage,
      notes: formData.notes,
      lost_reason: formData.lost_reason,
      metadata: {
        ...(trip?.metadata || {}),
        clients: formData.selectedClients,
        client_ids: formData.selectedClients.map(c => c.id)
      }
    };

    onSave(cleanedData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
            {trip ? 'Editar Viaje' : 'Nuevo Viaje'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">

          {/* Nombre del viaje */}
          <div className="space-y-2">
            <Label htmlFor="trip_name">Nombre del Viaje</Label>
            <Input
              id="trip_name"
              value={formData.trip_name}
              onChange={(e) => setFormData({ ...formData, trip_name: e.target.value })}
              className="rounded-xl"
              placeholder="Ej: Luna de miel Europa"
            />
          </div>

          {/* Clientes (multi-select) */}
          <div className="space-y-2">
            <Label>
              Clientes <span className="text-red-500">*</span>
              {formData.selectedClients.length > 0 && (
                <span className="ml-2 text-xs text-stone-400 font-normal">
                  {formData.selectedClients.length} seleccionado{formData.selectedClients.length !== 1 ? 's' : ''}
                </span>
              )}
            </Label>

            {prefilledClient ? (
              /* Cliente prefijado: solo mostrar, no editar */
              <div className="flex flex-wrap gap-1 p-2 border border-stone-200 rounded-xl bg-stone-50">
                {formData.selectedClients.map(c => (
                  <Badge key={c.id} variant="secondary" className="text-xs">
                    {c.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Badges de clientes seleccionados */}
                {formData.selectedClients.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 border border-stone-200 rounded-xl bg-stone-50 min-h-[40px]">
                    {formData.selectedClients.map((c, idx) => (
                      <Badge key={c.id} variant="secondary" className="text-xs gap-1 pr-1">
                        {idx === 0 && (
                          <span className="text-[10px] bg-stone-300 text-stone-600 rounded px-1 mr-0.5">principal</span>
                        )}
                        {c.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveClient(c.id)}
                          className="ml-0.5 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Buscador de clientes */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    ref={clientInputRef}
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder={formData.selectedClients.length === 0 ? "Buscar cliente..." : "Agregar otro cliente..."}
                    className="rounded-xl pl-9"
                  />

                  {/* Dropdown clientes */}
                  {showClientDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-[220px] overflow-y-auto">
                      {clients.length === 0 ? (
                        <div className="p-4 text-sm text-stone-500 text-center">
                          No tienes clientes. Crea uno primero.
                        </div>
                      ) : filteredClients.length > 0 ? (
                        <div className="p-2">
                          {filteredClients.map((client) => (
                            <div
                              key={client.id}
                              onMouseDown={() => handleAddClient(client)}
                              className="px-3 py-2 rounded-lg cursor-pointer hover:bg-stone-50 flex items-center gap-2 transition-colors"
                            >
                              <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-stone-600">
                                {client.first_name?.[0]}{client.last_name?.[0]}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{client.first_name} {client.last_name}</div>
                                {client.email && <div className="text-xs text-stone-400">{client.email}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : clientSearch ? (
                        <div className="p-4 text-sm text-stone-500 text-center">
                          No se encontraron clientes
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-stone-500 text-center flex items-center justify-center gap-2">
                          <Users className="w-4 h-4" />
                          Escribe para buscar clientes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Países */}
          <div className="space-y-2">
            <Label>Países <span className="text-red-500">*</span></Label>

            {formData.destination && (
              <div className="flex flex-wrap gap-1 mb-2">
                {formData.destination.split(', ').map((countryName) => (
                  <Badge key={countryName} variant="secondary" className="text-xs">
                    {countryName}
                    <X
                      className="w-3 h-3 ml-1 cursor-pointer"
                      onClick={() => {
                        const newDests = formData.destination.split(', ').filter(d => d !== countryName);
                        setFormData({ ...formData, destination: newDests.join(', ') });
                      }}
                    />
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Input
                ref={destinationInputRef}
                value={destinationSearch}
                onChange={handleDestinationInputChange}
                onFocus={() => setShowDestinationDropdown(true)}
                onBlur={handleDestinationInputBlur}
                placeholder="Escribe para buscar país..."
                className="rounded-xl pr-8"
                disabled={loadingCountries}
              />
              {loadingCountries ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-stone-400" />
              ) : (
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              )}

              {showDestinationDropdown && !loadingCountries && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                  {filteredCountries.length > 0 ? (
                    <div className="p-2">
                      {filteredCountries.map((country) => {
                        const isSelected = formData.destination?.split(', ').includes(country.name);
                        return (
                          <div
                            key={country.code}
                            onClick={() => handleCountrySelect(country.name)}
                            className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'hover:bg-stone-50'
                            }`}
                          >
                            <div className="font-medium text-sm">{country.name}</div>
                            <div className="text-xs text-stone-500 mt-0.5">
                              {country.subregion || country.region}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-stone-500 text-center">
                      No se encontraron países
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha inicio <span className="text-red-500">*</span></Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Personas y presupuesto */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="travelers">Número de personas</Label>
              <Input
                id="travelers"
                type="text"
                value={formData.travelers}
                onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                className="rounded-xl"
                placeholder="Ej: 2 o 2 adultos + 1 niño"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Presupuesto (USD)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || '' })}
                className="rounded-xl"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Mood y etapa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mood">Mood del viaje</Label>
              <Input
                id="mood"
                value={formData.mood}
                onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                className="rounded-xl"
                placeholder="Ej: Romántico, Aventura"
              />
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notas */}
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

          {/* Motivo pérdida */}
          {formData.stage === 'perdido' && (
            <div className="space-y-2 p-4 bg-red-50 rounded-xl border border-red-200">
              <Label htmlFor="lost_reason" className="text-red-700">Motivo de pérdida *</Label>
              <Textarea
                id="lost_reason"
                value={formData.lost_reason}
                onChange={(e) => setFormData({ ...formData, lost_reason: e.target.value })}
                rows={2}
                className="rounded-xl resize-none border-red-200"
                placeholder="Ej: Precio muy alto, eligió otra agencia, cambió de planes..."
                required={formData.stage === 'perdido'}
              />
            </div>
          )}

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
              {trip ? 'Actualizar' : 'Crear Viaje'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
