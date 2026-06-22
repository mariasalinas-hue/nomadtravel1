import { useState, useMemo } from 'react';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Loader2, ExternalLink, Folder, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseAPI } from '@/api/supabaseClient';
import { toast } from 'sonner';

const DOC_TYPES = {
  voucher_vuelo: { label: 'Voucher de Vuelo', color: 'bg-purple-100 text-purple-700' },
  reserva_hotel: { label: 'Reserva de Hotel', color: 'bg-blue-100 text-blue-700' },
  confirmacion_tour: { label: 'Confirmación de Tour', color: 'bg-emerald-100 text-emerald-700' },
  seguro_viaje: { label: 'Seguro de Viaje', color: 'bg-red-100 text-red-700' },
  comprobante_pago: { label: 'Comprobante de Pago', color: 'bg-green-100 text-green-700' },
  itinerario: { label: 'Itinerario', color: 'bg-amber-100 text-amber-700' },
  otro: { label: 'Otro', color: 'bg-stone-100 text-stone-700' }
};

const NO_FOLDER = '';
const folderOf = (doc) => (doc.metadata?.folder || '').trim();

export default function TripDocumentsList({ documents = [], soldTripId, onCreate, onDelete, onUpdate }) {
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ document_type: 'voucher_vuelo', name: '', notes: '', folder: '' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [file, setFile] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());

  // Carpetas existentes en este viaje (para sugerencias y para mover)
  const allFolders = useMemo(
    () => [...new Set(documents.map(folderOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [documents]
  );

  // Documentos agrupados por carpeta (las nombradas primero, "Sin carpeta" al final)
  const groups = useMemo(() => {
    const map = new Map();
    documents.forEach((d) => {
      const f = folderOf(d);
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(d);
    });
    return [...map.entries()].sort((a, b) => {
      if (a[0] === NO_FOLDER) return 1;
      if (b[0] === NO_FOLDER) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [documents]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Selecciona un archivo');
      return;
    }
    setUploadingFile(true);
    try {
      const { file_url, file_path } = await supabaseAPI.storage.uploadFile(file, 'trip-documents');
      await onCreate({
        sold_trip_id: soldTripId,
        document_type: formData.document_type,
        name: formData.name,
        file_url,
        notes: formData.notes,
        metadata: { folder: formData.folder.trim() || null, file_path: file_path || null }
      });
      setFormOpen(false);
      setFormData({ document_type: 'voucher_vuelo', name: '', notes: '', folder: '' });
      setFile(null);
      toast.success('Documento subido');
    } catch (error) {
      toast.error('Error al subir archivo');
      console.error(error);
    } finally {
      setUploadingFile(false);
    }
  };

  const moveToFolder = (doc, folder) => {
    if (!onUpdate) return;
    onUpdate(doc.id, { metadata: { ...(doc.metadata || {}), folder: folder || null } });
    toast.success(folder ? `Movido a "${folder}"` : 'Movido a Sin carpeta');
  };

  const handleMoveChange = (doc, value) => {
    if (value === '__current__') return;
    if (value === '__none__') return moveToFolder(doc, '');
    if (value === '__new__') {
      const name = window.prompt('Nombre de la nueva carpeta:');
      if (name && name.trim()) moveToFolder(doc, name.trim());
      return;
    }
    moveToFolder(doc, value);
  };

  const toggleFolder = (key) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const renderCard = (doc) => {
    const docTypeInfo = DOC_TYPES[doc.document_type] || DOC_TYPES.otro;
    const current = folderOf(doc);
    return (
      <motion.div
        key={doc.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white border border-stone-200 rounded-xl p-4 hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${docTypeInfo.color}`}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-800 truncate">{doc.name}</p>
            <p className={`text-xs font-medium mt-1 ${docTypeInfo.color} inline-block px-2 py-0.5 rounded`}>
              {docTypeInfo.label}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {formatDate(doc.created_date, 'd MMM yyyy', { locale: es })}
            </p>
            {doc.notes && <p className="text-xs text-stone-500 mt-1 italic">"{doc.notes}"</p>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(doc.file_url, '_blank')}>
              <ExternalLink className="w-4 h-4 text-stone-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-400 hover:text-red-500"
              onClick={() => onDelete(doc.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mover a carpeta */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
          <Folder className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
          <Select value="__current__" onValueChange={(v) => handleMoveChange(doc, v)}>
            <SelectTrigger className="h-7 rounded-lg text-xs border-stone-200 text-stone-500">
              <SelectValue>{current || 'Sin carpeta'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin carpeta</SelectItem>
              {allFolders.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
              <SelectItem value="__new__">➕ Nueva carpeta…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)} className="rounded-xl text-white" style={{ backgroundColor: '#2E442A' }}>
          <Upload className="w-4 h-4 mr-2" />
          Subir Documento
        </Button>
      </div>

      {/* Documentos agrupados por carpeta */}
      <div className="space-y-4">
        {groups.map(([key, docs]) => {
          const isOpen = !collapsed.has(key);
          const isNoFolder = key === NO_FOLDER;
          return (
            <div key={key || '__no_folder__'} className="rounded-xl border border-stone-200 overflow-hidden">
              <button
                onClick={() => toggleFolder(key)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronRight className="w-4 h-4 text-stone-400" />}
                {isOpen
                  ? <FolderOpen className="w-4 h-4" style={{ color: isNoFolder ? '#a8a29e' : '#2E442A' }} />
                  : <Folder className="w-4 h-4" style={{ color: isNoFolder ? '#a8a29e' : '#2E442A' }} />}
                <span className={`text-sm font-semibold ${isNoFolder ? 'text-stone-500' : 'text-stone-800'}`}>
                  {isNoFolder ? 'Sin carpeta' : key}
                </span>
                <span className="text-xs text-stone-400 bg-white border border-stone-200 rounded-full px-2 py-0.5 ml-1">
                  {docs.length}
                </span>
              </button>
              {isOpen && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>{docs.map(renderCard)}</AnimatePresence>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-8 text-stone-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay documentos. Sube el primer documento.</p>
        </div>
      )}

      {/* Upload Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#2E442A' }}>Subir Documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select
                value={formData.document_type}
                onValueChange={(value) => setFormData({ ...formData, document_type: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([key, info]) => (
                    <SelectItem key={key} value={key}>{info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Carpeta (opcional)</Label>
              <Input
                list="trip-folder-options"
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                placeholder="Ej: Vuelo MTY-MAD, Hotel Ritz…"
                className="rounded-xl"
              />
              <datalist id="trip-folder-options">
                {allFolders.map((f) => <option key={f} value={f} />)}
              </datalist>
              <p className="text-[11px] text-stone-400">
                Escribe un nombre nuevo para crear una carpeta, o elige una existente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nombre del Documento</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Voucher Vuelo MX-NY"
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Archivo</Label>
              <Input
                type="file"
                onChange={handleFileChange}
                className="rounded-xl"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                className="rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={uploadingFile || !file}
                className="rounded-xl text-white"
                style={{ backgroundColor: '#2E442A' }}
              >
                {uploadingFile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Subir
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
