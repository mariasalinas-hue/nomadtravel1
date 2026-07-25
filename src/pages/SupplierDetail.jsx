import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Building2, Star, MapPin, Globe, Link2, 
  Phone, Mail, User, Plus, Edit2, Trash2, Loader2,
  FileText, Upload, ExternalLink, Clock, CreditCard,
  AlertTriangle, MoreVertical
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPLIER_ACCEPTED_METHOD_LABELS as PAYMENT_LABELS } from '@/config/paymentMethods';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SupplierForm from '@/components/suppliers/SupplierForm';
import ContactForm from '@/components/suppliers/ContactForm';
import DocumentForm from '@/components/suppliers/DocumentForm';
import EmptyState from '@/components/ui/EmptyState';

const SUPPLIER_TYPES = {
  dmc: 'DMC',
  hotel_directo: 'Hotel Directo',
  cadena_hotelera: 'Cadena Hotelera',
  aerolinea: 'Aerolínea',
  plataforma: 'Plataforma',
  transporte: 'Transporte',
  tours: 'Tours / Actividades',
  otro: 'Otro'
};

const DOC_TYPE_LABELS = {
  tarifario: 'Tarifario',
  politicas: 'Políticas',
  comisiones: 'Comisiones',
  presentacion: 'Presentación',
  otro: 'Otro'
};

export default function SupplierDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const supplierId = urlParams.get('id');

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [documentFormOpen, setDocumentFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const queryClient = useQueryClient();

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: async () => {
      const results = await supabaseAPI.entities.Supplier.filter({ id: supplierId });
      return results[0];
    },
    enabled: !!supplierId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['supplierContacts', supplierId],
    queryFn: () => supabaseAPI.entities.SupplierContact.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['supplierDocuments', supplierId],
    queryFn: () => supabaseAPI.entities.SupplierDocument.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  });

  // Mutations
  const updateSupplierMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.Supplier.update(supplierId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
      setEditFormOpen(false);
    }
  });

  const createContactMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.SupplierContact.create({ ...data, supplier_id: supplierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierContacts', supplierId] });
      setContactFormOpen(false);
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.SupplierContact.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierContacts', supplierId] });
      setContactFormOpen(false);
      setEditingContact(null);
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.SupplierContact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierContacts', supplierId] });
      setDeleteConfirm(null);
    }
  });

  const createDocumentMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.SupplierDocument.create({ ...data, supplier_id: supplierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDocuments', supplierId] });
      setDocumentFormOpen(false);
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.SupplierDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDocuments', supplierId] });
      setDocumentFormOpen(false);
      setEditingDocument(null);
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.SupplierDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierDocuments', supplierId] });
      setDeleteConfirm(null);
    }
  });

  const handleSaveContact = (data) => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data });
    } else {
      createContactMutation.mutate(data);
    }
  };

  const handleSaveDocument = (data) => {
    if (editingDocument) {
      updateDocumentMutation.mutate({ id: editingDocument.id, data });
    } else {
      createDocumentMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Proveedor no encontrado</p>
        <Link to={createPageUrl('Suppliers')}>
          <Button variant="link" style={{ color: '#2E442A' }}>Volver a proveedores</Button>
        </Link>
      </div>
    );
  }

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-stone-300'}`} />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex items-start gap-4 flex-1">
            <Link to={createPageUrl('Suppliers')}>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#2E442A15' }}>
              <Building2 className="w-8 h-8" style={{ color: '#2E442A' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-stone-800">{supplier.name}</h1>
                <Badge className="bg-purple-100 text-purple-700">{SUPPLIER_TYPES[supplier.type]}</Badge>
              </div>
              {supplier.rating > 0 && (
                <div className="flex items-center gap-1 mb-2">{renderStars(supplier.rating)}</div>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-stone-500">
                {supplier.currency && <span>Moneda: {supplier.currency}</span>}
                {supplier.commission && <span>• Comisión: {supplier.commission}</span>}
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setEditFormOpen(true)}
            variant="outline"
            className="rounded-xl"
            style={{ borderColor: '#2E442A', color: '#2E442A' }}
          >
            <Edit2 className="w-4 h-4 mr-2" /> Editar
          </Button>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-100">
          {supplier.website && (
            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
              <Globe className="w-4 h-4" /> Website
            </a>
          )}
          {supplier.agent_portal && (
            <a href={supplier.agent_portal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
              <Link2 className="w-4 h-4" /> Portal de agentes
            </a>
          )}
          {supplier.documents_folder && (
            <a href={supplier.documents_folder} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800">
              <FileText className="w-4 h-4" /> Carpeta docs
            </a>
          )}
          {supplier.agent_id && (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <User className="w-4 h-4" /> ID: {supplier.agent_id}
            </div>
          )}
        </div>
      </div>

      {/* Destinations & Services */}
      {(supplier.destinations?.length > 0 || supplier.services?.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {supplier.destinations?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5">
              <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: '#2E442A' }} /> Destinos
              </h3>
              <div className="flex flex-wrap gap-2">
                {supplier.destinations.map(d => <Badge key={d} variant="outline">{d}</Badge>)}
              </div>
            </div>
          )}
          {supplier.services?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5">
              <h3 className="font-semibold text-stone-800 mb-3">Servicios</h3>
              <div className="flex flex-wrap gap-2">
                {supplier.services.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList className="bg-stone-100 p-1 rounded-xl">
          <TabsTrigger value="contacts" className="rounded-lg">Contactos <Badge variant="secondary" className="ml-2 text-xs">{contacts.length}</Badge></TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg">Documentos <Badge variant="secondary" className="ml-2 text-xs">{documents.length}</Badge></TabsTrigger>
          <TabsTrigger value="operativo" className="rounded-lg">Info Operativa</TabsTrigger>
          <TabsTrigger value="historial" className="rounded-lg">Historial</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-stone-800">Contactos del Proveedor</h3>
              <Button size="sm" onClick={() => { setEditingContact(null); setContactFormOpen(true); }} className="rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
                <Plus className="w-4 h-4 mr-1" /> Agregar Contacto
              </Button>
            </div>
            {contacts.length === 0 ? (
              <EmptyState icon={User} title="Sin contactos" description="Agrega contactos de este proveedor" actionLabel="Agregar Contacto" onAction={() => setContactFormOpen(true)} />
            ) : (
              <div className="divide-y divide-stone-100">
                {contacts.sort((a, b) => (a.priority || 99) - (b.priority || 99)).map((contact) => (
                  <div key={contact.id} className="p-4 hover:bg-stone-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-stone-100">
                          <User className="w-5 h-5 text-stone-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-stone-800">{contact.name}</p>
                            {contact.priority === 1 && <Badge className="bg-red-100 text-red-700 text-xs">Emergencia</Badge>}
                          </div>
                          {contact.position && <p className="text-sm text-stone-500">{contact.position}</p>}
                          <div className="flex flex-wrap gap-3 mt-2 text-sm">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-stone-600 hover:text-stone-800">
                                <Mail className="w-3 h-3" /> {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-stone-600 hover:text-stone-800">
                                <Phone className="w-3 h-3" /> {contact.phone}
                              </a>
                            )}
                          </div>
                          {contact.timezone && <p className="text-xs text-stone-400 mt-1">{contact.timezone}</p>}
                          {contact.notes && <p className="text-xs text-stone-500 mt-2 italic">"{contact.notes}"</p>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingContact(contact); setContactFormOpen(true); }}><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => setDeleteConfirm({ type: 'contact', item: contact })}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-semibold text-stone-800">Documentos</h3>
              <Button size="sm" onClick={() => { setEditingDocument(null); setDocumentFormOpen(true); }} className="rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
                <Plus className="w-4 h-4 mr-1" /> Agregar Documento
              </Button>
            </div>
            {documents.length === 0 ? (
              <EmptyState icon={FileText} title="Sin documentos" description="Sube tarifarios, políticas y más" actionLabel="Agregar Documento" onAction={() => setDocumentFormOpen(true)} />
            ) : (
              <div className="divide-y divide-stone-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">{doc.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[doc.type] || doc.type}</Badge>
                          {doc.notes && <span className="text-xs text-stone-400">{doc.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingDocument(doc); setDocumentFormOpen(true); }}><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => setDeleteConfirm({ type: 'document', item: doc })}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Operativo Tab */}
        <TabsContent value="operativo">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-6">
            {supplier.payment_methods?.length > 0 && (
              <div>
                <h4 className="font-semibold text-stone-800 mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Formas de Pago</h4>
                <div className="flex flex-wrap gap-2">
                  {supplier.payment_methods.map(pm => <Badge key={pm} variant="outline">{PAYMENT_LABELS[pm] || pm}</Badge>)}
                </div>
              </div>
            )}
            {supplier.policies && (
              <div>
                <h4 className="font-semibold text-stone-800 mb-2">Políticas</h4>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{supplier.policies}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {supplier.business_hours && (
                <div>
                  <h4 className="font-semibold text-stone-800 mb-1 flex items-center gap-2"><Clock className="w-4 h-4" /> Horarios</h4>
                  <p className="text-sm text-stone-600">{supplier.business_hours}</p>
                </div>
              )}
              {supplier.confirmation_time && (
                <div>
                  <h4 className="font-semibold text-stone-800 mb-1">Tiempo de Confirmación</h4>
                  <p className="text-sm text-stone-600">{supplier.confirmation_time}</p>
                </div>
              )}
            </div>
            {supplier.internal_notes && (
              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">Notas Internas</h4>
                <p className="text-sm text-yellow-700 whitespace-pre-wrap">{supplier.internal_notes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Historial Tab */}
        <TabsContent value="historial">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-6">
            {supplier.team_comments && (
              <div>
                <h4 className="font-semibold text-stone-800 mb-2">Comentarios del Equipo</h4>
                <p className="text-sm text-stone-600 whitespace-pre-wrap">{supplier.team_comments}</p>
              </div>
            )}
            {supplier.issues && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Problemas Reportados</h4>
                <p className="text-sm text-red-700 whitespace-pre-wrap">{supplier.issues}</p>
              </div>
            )}
            {supplier.last_used && (
              <div>
                <h4 className="font-semibold text-stone-800 mb-1">Última vez usado</h4>
                <p className="text-sm text-stone-600">{formatDate(supplier.last_used, 'd MMMM yyyy', { locale: es })}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms */}
      <SupplierForm open={editFormOpen} onClose={() => setEditFormOpen(false)} supplier={supplier} onSave={(data) => updateSupplierMutation.mutate(data)} isLoading={updateSupplierMutation.isPending} />
      <ContactForm open={contactFormOpen} onClose={() => { setContactFormOpen(false); setEditingContact(null); }} contact={editingContact} onSave={handleSaveContact} isLoading={createContactMutation.isPending || updateContactMutation.isPending} />
      <DocumentForm open={documentFormOpen} onClose={() => { setDocumentFormOpen(false); setEditingDocument(null); }} document={editingDocument} onSave={handleSaveDocument} isLoading={createDocumentMutation.isPending || updateDocumentMutation.isPending} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteConfirm.type === 'contact') deleteContactMutation.mutate(deleteConfirm.item.id);
              else if (deleteConfirm.type === 'document') deleteDocumentMutation.mutate(deleteConfirm.item.id);
            }} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}