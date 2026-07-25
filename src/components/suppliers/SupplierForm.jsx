import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, X, Star, Sparkles, Upload, Image } from 'lucide-react';
import { supabaseAPI } from '@/api/supabaseClient';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPLIER_ACCEPTED_METHODS as PAYMENT_METHODS } from '@/config/paymentMethods';

const SUPPLIER_TYPES = [
  { value: 'dmc', label: 'DMC' },
  { value: 'hotel_directo', label: 'Hotel Directo' },
  { value: 'cadena_hotelera', label: 'Cadena Hotelera' },
  { value: 'aerolinea', label: 'Aerolínea' },
  { value: 'plataforma', label: 'Plataforma (TBO, RateHawk, etc.)' },
  { value: 'transporte', label: 'Transporte / Traslados' },
  { value: 'tours', label: 'Tours / Actividades' },
  { value: 'agencia_representante', label: 'Agencia Representante' },
  { value: 'otro', label: 'Otro' }
];

const DESTINATIONS = [
  'Sudeste Asiático', 'Asia Oriental', 'Asia del Sur', 'Medio Oriente',
  'Europa Occidental', 'Europa del Este', 'Europa del Norte', 'Europa del Sur',
  'África del Norte', 'África del Este', 'África del Sur', 'África Occidental',
  'Oceanía / Pacífico', 'Norteamérica', 'Caribe', 'Centroamérica', 'Sudamérica',
  'Islas del Índico', 'Islas del Mediterráneo'
];

const SERVICES = [
  'Hoteles', 'Vuelos', 'Traslados', 'Tours', 'Cruceros', 'Seguros', 'Renta de Autos', 'Experiencias'
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - Dólar' },
  { value: 'MXN', label: 'MXN - Peso Mexicano' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Libra' },
  { value: 'otro', label: 'Otro' }
];

export default function SupplierForm({ open, onClose, supplier, onSave, isLoading, showSmartImportOnOpen = false }) {
  const [smartImportText, setSmartImportText] = useState('');
  const [showSmartImport, setShowSmartImport] = useState(showSmartImportOnOpen);
  const [importing, setImporting] = useState(false);
  const [representativeAgencies, setRepresentativeAgencies] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const fetchAgencies = async () => {
      const agencies = await supabaseAPI.entities.Supplier.filter({ type: 'agencia_representante' });
      setRepresentativeAgencies(agencies);
    };
    if (open) {
      fetchAgencies();
    }
  }, [open]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingImage(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await supabaseAPI.storage.uploadFile(file, 'documents', 'supplier-imports');
        urls.push(file_url);
      }
      setUploadedImages(prev => [...prev, ...urls]);
      toast.success('Imagen(es) subida(s)');
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Error al subir imagen. Verifica que el storage esté configurado.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSmartImportFromImages = async () => {
    // NOTA: Smart Import con AI requiere configuración de LLM
    // Comentado temporalmente hasta que se configure la integración
    toast.error('Smart Import con AI aún no está disponible. Por favor, ingresa los datos manualmente.');
    return;

    /*
    if (uploadedImages.length === 0) {
      toast.error('Sube al menos una imagen');
      return;
    }
    setImporting(true);
    try {
      // Aquí iría la integración con un servicio de AI/LLM
      // Por ejemplo: OpenAI, Claude, etc.
      toast.success('Datos importados correctamente');
    } catch (error) {
      toast.error('Error al procesar las imágenes');
    } finally {
      setImporting(false);
    }
    */
  };

  const applyImportedData = (result) => {
    setFormData(prev => ({
      ...prev,
      name: result.name || prev.name,
      type: result.type || prev.type,
      destinations: result.destinations?.length ? result.destinations : prev.destinations,
      services: result.services?.length ? result.services : prev.services,
      website: result.website || prev.website,
      internal_notes: result.internal_notes || prev.internal_notes,
      contact1_name: result.contact1_name || prev.contact1_name,
      contact1_email: result.contact1_email || prev.contact1_email,
      contact1_phone: result.contact1_phone || prev.contact1_phone,
      contact2_name: result.contact2_name || prev.contact2_name,
      contact2_email: result.contact2_email || prev.contact2_email,
      contact2_phone: result.contact2_phone || prev.contact2_phone
    }));
    setShowSmartImport(false);
    setSmartImportText('');
  };

  const handleSmartImport = async () => {
    // NOTA: Smart Import con AI requiere configuración de LLM
    // Comentado temporalmente hasta que se configure la integración
    toast.error('Smart Import con AI aún no está disponible. Por favor, ingresa los datos manualmente.');
    return;

    /*
    if (!smartImportText.trim()) {
      toast.error('Pega el texto del proveedor');
      return;
    }
    setImporting(true);
    try {
      // Aquí iría la integración con un servicio de AI/LLM
      // Por ejemplo: OpenAI, Claude, etc.
      toast.success('Datos importados correctamente');
    } catch (error) {
      toast.error('Error al procesar el texto');
    } finally {
      setImporting(false);
    }
    */
  };

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    representative_agency_id: 'none',
    contact1_name: '',
    contact1_phone: '',
    contact1_email: '',
    contact2_name: '',
    contact2_phone: '',
    contact2_email: '',
    internal_notes: '',
    destinations: [],
    services: [],
    commission: '',
    currency: 'USD',
    response_time: '',
    website: '',
    agent_portal: '',
    agent_id: '',
    documents_folder: '',
    payment_methods: [],
    policies: '',
    business_hours: '',
    confirmation_time: '',
    rating: 0,
    team_comments: '',
    issues: ''
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        type: supplier.type || '',
        representative_agency_id: supplier.representative_agency_id || 'none',
        contact1_name: supplier.contact1_name || '',
        contact1_phone: supplier.contact1_phone || '',
        contact1_email: supplier.contact1_email || '',
        contact2_name: supplier.contact2_name || '',
        contact2_phone: supplier.contact2_phone || '',
        contact2_email: supplier.contact2_email || '',
        internal_notes: supplier.internal_notes || '',
        destinations: supplier.destinations || [],
        services: supplier.services || [],
        commission: supplier.commission || '',
        currency: supplier.currency || 'USD',
        response_time: supplier.response_time || '',
        website: supplier.website || '',
        agent_portal: supplier.agent_portal || '',
        agent_id: supplier.agent_id || '',
        documents_folder: supplier.documents_folder || '',
        payment_methods: supplier.payment_methods || [],
        policies: supplier.policies || '',
        business_hours: supplier.business_hours || '',
        confirmation_time: supplier.confirmation_time || '',
        rating: supplier.rating || 0,
        team_comments: supplier.team_comments || '',
        issues: supplier.issues || ''
      });
    } else {
      setFormData({
        name: '',
        type: '',
        representative_agency_id: 'none',
        contact1_name: '',
        contact1_phone: '',
        contact1_email: '',
        contact2_name: '',
        contact2_phone: '',
        contact2_email: '',
        internal_notes: '',
        destinations: [],
        services: [],
        commission: '',
        currency: 'USD',
        response_time: '',
        website: '',
        agent_portal: '',
        agent_id: '',
        documents_folder: '',
        payment_methods: [],
        policies: '',
        business_hours: '',
        confirmation_time: '',
        rating: 0,
        team_comments: '',
        issues: ''
      });
    }
  }, [supplier, open]);

  useEffect(() => {
    if (open) {
      setShowSmartImport(showSmartImportOnOpen);
    }
  }, [open, showSmartImportOnOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Limpiar valores vacíos en campos UUID para evitar errores
    const cleanedData = {
      ...formData,
      representative_agency_id: formData.representative_agency_id === 'none' ? null : formData.representative_agency_id
    };

    onSave(cleanedData);
  };

  const toggleArrayItem = (field, item) => {
    const current = formData[field] || [];
    if (current.includes(item)) {
      setFormData({ ...formData, [field]: current.filter(i => i !== item) });
    } else {
      setFormData({ ...formData, [field]: [...current, item] });
    }
  };

  const MultiSelectField = ({ label, field, options }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start rounded-xl font-normal h-auto min-h-10 py-2">
            {formData[field]?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {formData[field].map((item) => (
                  <Badge key={item} variant="secondary" className="text-xs">
                    {item}
                    <X className="w-3 h-3 ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleArrayItem(field, item); }} />
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-stone-400">Seleccionar</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  id={`${field}-${opt}`}
                  checked={formData[field]?.includes(opt)}
                  onCheckedChange={() => toggleArrayItem(field, opt)}
                />
                <label htmlFor={`${field}-${opt}`} className="text-sm cursor-pointer">{opt}</label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
              {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
            {!supplier && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSmartImport(!showSmartImport)}
                className="rounded-xl text-xs"
              >
                <Sparkles className="w-4 h-4 mr-1" style={{ color: '#2E442A' }} />
                Smart Import
              </Button>
            )}
          </div>
        </DialogHeader>

        {showSmartImport && (
          <div className="p-4 bg-stone-50 rounded-xl space-y-4 border border-stone-200">
            {/* Opción 1: Texto */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">Opción 1: Pegar texto</p>
              <textarea
                value={smartImportText}
                onChange={(e) => setSmartImportText(e.target.value)}
                className="w-full h-24 p-3 text-sm border border-stone-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2E442A]"
                placeholder="Pega el texto del proveedor (email, info de contacto, etc.)"
              />
              <Button
                type="button"
                onClick={handleSmartImport}
                disabled={importing || !smartImportText.trim()}
                className="rounded-xl text-white text-xs"
                style={{ backgroundColor: '#2E442A' }}
              >
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Importar desde texto
              </Button>
            </div>

            <div className="border-t border-stone-200 pt-4">
              {/* Opción 2: Imágenes */}
              <p className="text-sm font-medium text-stone-700 mb-2">Opción 2: Subir imágenes</p>
              <p className="text-xs text-stone-500 mb-2">Sube fotos de tarjetas de presentación, capturas de pantalla, emails, etc.</p>
              
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {uploadedImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      <button 
                        type="button" 
                        onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors text-xs">
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{uploadingImage ? 'Subiendo...' : 'Subir imagen'}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
                
                {uploadedImages.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleSmartImportFromImages}
                    disabled={importing}
                    className="rounded-xl text-white text-xs"
                    style={{ backgroundColor: '#2E442A' }}
                  >
                    {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Image className="w-4 h-4 mr-1" />}
                    Importar desde imágenes
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-200">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setShowSmartImport(false); setSmartImportText(''); setUploadedImages([]); }}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="operativo">Operativo</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del Proveedor *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Proveedor *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v, representative_agency_id: v === 'agencia_representante' ? 'none' : formData.representative_agency_id })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Agencia Representante - solo si NO es agencia representante */}
              {formData.type && formData.type !== 'agencia_representante' && (
                <div className="space-y-2">
                  <Label>Agencia Representante</Label>
                  <Select 
                    value={formData.representative_agency_id} 
                    onValueChange={(v) => setFormData({ ...formData, representative_agency_id: v })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Seleccionar agencia representante (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {representativeAgencies.map(agency => (
                        <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Contacto 1 */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-3">
                <Label className="font-semibold text-stone-700">Contacto 1</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Nombre</Label>
                    <Input
                      value={formData.contact1_name}
                      onChange={(e) => setFormData({ ...formData, contact1_name: e.target.value })}
                      className="rounded-xl"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Teléfono</Label>
                    <Input
                      value={formData.contact1_phone}
                      onChange={(e) => setFormData({ ...formData, contact1_phone: e.target.value })}
                      className="rounded-xl"
                      placeholder="+52 81..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Email</Label>
                    <Input
                      value={formData.contact1_email}
                      onChange={(e) => setFormData({ ...formData, contact1_email: e.target.value })}
                      className="rounded-xl"
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                </div>
              </div>

              {/* Contacto 2 */}
              <div className="p-4 bg-stone-50 rounded-xl space-y-3">
                <Label className="font-semibold text-stone-700">Contacto 2</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Nombre</Label>
                    <Input
                      value={formData.contact2_name}
                      onChange={(e) => setFormData({ ...formData, contact2_name: e.target.value })}
                      className="rounded-xl"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Teléfono</Label>
                    <Input
                      value={formData.contact2_phone}
                      onChange={(e) => setFormData({ ...formData, contact2_phone: e.target.value })}
                      className="rounded-xl"
                      placeholder="+52 81..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-stone-500">Email</Label>
                    <Input
                      value={formData.contact2_email}
                      onChange={(e) => setFormData({ ...formData, contact2_email: e.target.value })}
                      className="rounded-xl"
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                </div>
              </div>

              {/* Notas internas */}
              <div className="space-y-2">
                <Label>Notas internas</Label>
                <Textarea
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  className="rounded-xl resize-none"
                  rows={3}
                  placeholder="Notas generales sobre el proveedor..."
                />
              </div>

              <MultiSelectField label="Destinos en los que opera" field="destinations" options={DESTINATIONS} />
              <MultiSelectField label="Servicios que ofrece" field="services" options={SERVICES} />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comisiones aproximadas</Label>
                  <Input
                    value={formData.commission}
                    onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                    className="rounded-xl"
                    placeholder="Ej: 10-15%"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tiempos de respuesta / SLA</Label>
                <Input
                  value={formData.response_time}
                  onChange={(e) => setFormData({ ...formData, response_time: e.target.value })}
                  className="rounded-xl"
                  placeholder="Ej: 24-48 horas"
                />
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-4">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="rounded-xl"
                  placeholder="https://"
                />
              </div>
              <div className="space-y-2">
                <Label>Portal de agentes</Label>
                <Input
                  value={formData.agent_portal}
                  onChange={(e) => setFormData({ ...formData, agent_portal: e.target.value })}
                  className="rounded-xl"
                  placeholder="https://"
                />
              </div>
              <div className="space-y-2">
                <Label>Login / Número de ID</Label>
                <Input
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Carpeta de documentos (Drive/Dropbox)</Label>
                <Input
                  value={formData.documents_folder}
                  onChange={(e) => setFormData({ ...formData, documents_folder: e.target.value })}
                  className="rounded-xl"
                  placeholder="https://"
                />
              </div>
            </TabsContent>

            <TabsContent value="operativo" className="space-y-4">
              <div className="space-y-2">
                <Label>Formas de pago</Label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map(pm => (
                    <Badge 
                      key={pm.value}
                      variant={formData.payment_methods?.includes(pm.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleArrayItem('payment_methods', pm.value)}
                    >
                      {pm.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Políticas relevantes</Label>
                <Textarea
                  value={formData.policies}
                  onChange={(e) => setFormData({ ...formData, policies: e.target.value })}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horarios de respuesta</Label>
                  <Input
                    value={formData.business_hours}
                    onChange={(e) => setFormData({ ...formData, business_hours: e.target.value })}
                    className="rounded-xl"
                    placeholder="Ej: L-V 9am-6pm CST"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tiempo de confirmación</Label>
                  <Input
                    value={formData.confirmation_time}
                    onChange={(e) => setFormData({ ...formData, confirmation_time: e.target.value })}
                    className="rounded-xl"
                    placeholder="Ej: 24-48 hrs"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historial" className="space-y-4">
              <div className="space-y-2">
                <Label>Puntaje interno</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="p-1"
                    >
                      <Star className={`w-6 h-6 ${star <= formData.rating ? 'fill-yellow-400 text-yellow-400' : 'text-stone-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Comentarios del equipo</Label>
                <Textarea
                  value={formData.team_comments}
                  onChange={(e) => setFormData({ ...formData, team_comments: e.target.value })}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Problemas o retrasos previos</Label>
                <Textarea
                  value={formData.issues}
                  onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {supplier ? 'Actualizar' : 'Crear Proveedor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}