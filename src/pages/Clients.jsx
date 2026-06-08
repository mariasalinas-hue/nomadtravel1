import React, { useState, useContext, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ViewModeContext } from '@/Layout';
import { useSpoofableUser } from '@/contexts/SpoofContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/dateUtils';
import { parseLocalDate } from '@/components/utils/dateHelpers';
import {
  Plus, Search, Edit2, Trash2, Loader2, Users, Eye, Cake, Plane, Share2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import ClientForm from '@/components/clients/ClientForm';
import ShareClientFormModal from '@/components/clients/ShareClientFormModal';
import EmptyState from '@/components/ui/EmptyState';

const SOURCE_LABELS = {
  referido: 'Referido',
  instagram: 'Instagram',
  facebook: 'Facebook',
  otro: 'Otro'
};

// Days until the client's next birthday (ignoring year). null if no/invalid date.
const daysUntilBirthday = (birthDate) => {
  if (!birthDate) return null;
  const bd = parseLocalDate(birthDate);
  if (!bd || isNaN(bd.getTime())) return null;
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < todayMid) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
  return Math.round((next - todayMid) / (1000 * 60 * 60 * 24));
};

export default function Clients() {
  const { viewMode } = useContext(ViewModeContext);
  const { user: clerkUser } = useSpoofableUser();

  // Convert Clerk user to app user format
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
    full_name: clerkUser.fullName || clerkUser.username,
    role: clerkUser.publicMetadata?.role || 'user',
    custom_role: clerkUser.publicMetadata?.custom_role
  } : null;

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [formOpen, setFormOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'admin' && viewMode === 'admin';

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) {
        return supabaseAPI.entities.Client.list();
      } else {
        return supabaseAPI.entities.Client.filter({ created_by: user.email });
      }
    },
    enabled: !!user
  });

  // Sold trips → used to compute each client's value (# trips, total, last trip)
  const { data: allSoldTrips = [] } = useQuery({
    queryKey: ['soldTrips', user?.email, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      if (isAdmin) return supabaseAPI.entities.SoldTrip.list();
      return supabaseAPI.entities.SoldTrip.filter({ created_by: user.email });
    },
    enabled: !!user
  });

  // Aggregate sold trips per client_id
  const statsByClient = useMemo(() => {
    const map = {};
    allSoldTrips.forEach(t => {
      if (t.is_deleted || !t.client_id) return;
      const s = map[t.client_id] || { count: 0, total: 0, lastDate: null };
      s.count += 1;
      s.total += (t.total_price || 0);
      const d = t.start_date || t.created_date;
      if (d && (!s.lastDate || new Date(d) > new Date(s.lastDate))) s.lastDate = d;
      map[t.client_id] = s;
    });
    return map;
  }, [allSoldTrips]);

  const getStats = (id) => statsByClient[id] || { count: 0, total: 0, lastDate: null };

  const createMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormOpen(false);
      setEditingClient(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => supabaseAPI.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDeleteConfirm(null);
    }
  });

  const handleSave = (data) => {
    // Convert empty strings to null for date fields
    const cleanedData = {
      ...data,
      birth_date: data.birth_date || null
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: cleanedData });
    } else {
      createMutation.mutate({ ...cleanedData, created_by: user?.email });
    }
  };

  // Search (full name + email + phone) and source filter
  const filteredClients = clients.filter(client => {
    if (sourceFilter !== 'all' && client.source !== sourceFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    return (
      fullName.includes(q) ||
      client.email?.toLowerCase().includes(q) ||
      client.phone?.includes(search)
    );
  });

  // Sorting
  const sortedClients = useMemo(() => {
    const arr = [...filteredClients];
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`);
        case 'trips':
          return getStats(b.id).count - getStats(a.id).count;
        case 'total':
          return getStats(b.id).total - getStats(a.id).total;
        case 'birthday': {
          const da = daysUntilBirthday(a.birth_date);
          const db = daysUntilBirthday(b.birth_date);
          return (da ?? 99999) - (db ?? 99999);
        }
        default:
          return 0; // 'recent' keeps the default (created_date desc) order
      }
    });
    return arr;
  }, [filteredClients, sortBy, statsByClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-stone-800">Clientes</h1>
          <p className="text-stone-500 mt-1">{clients.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShareOpen(true)}
            variant="outline"
            className="rounded-xl"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir formulario
          </Button>
          <Button
            onClick={() => { setEditingClient(null); setFormOpen(true); }}
            className="text-white rounded-xl"
            style={{ backgroundColor: '#2E442A' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Controls: search + filters + sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl">
            <SelectValue placeholder="Fuente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fuentes</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="name">Nombre (A-Z)</SelectItem>
            <SelectItem value="trips">Más viajes</SelectItem>
            <SelectItem value="total">Mayor gasto</SelectItem>
            <SelectItem value="birthday">Cumpleaños próximo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients List */}
      {sortedClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || sourceFilter !== 'all' ? "Sin resultados" : "Sin clientes"}
          description={search || sourceFilter !== 'all' ? "No se encontraron clientes con esos filtros" : "Agrega tu primer cliente para comenzar"}
          actionLabel={!search && sourceFilter === 'all' ? "Agregar Cliente" : undefined}
          onAction={!search && sourceFilter === 'all' ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left p-4 font-medium text-stone-600">Cliente</th>
                  <th className="text-left p-4 font-medium text-stone-600">Teléfono</th>
                  <th className="text-left p-4 font-medium text-stone-600">Viajes</th>
                  <th className="text-right p-4 font-medium text-stone-600">Total vendido</th>
                  <th className="text-left p-4 font-medium text-stone-600">Cumpleaños</th>
                  <th className="text-right p-4 font-medium text-stone-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedClients.map((client) => {
                  const stats = getStats(client.id);
                  const bdays = daysUntilBirthday(client.birth_date);
                  const bdaySoon = bdays !== null && bdays <= 30;
                  return (
                    <tr key={client.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                            style={{ backgroundColor: '#2E442A' }}
                          >
                            {client.first_name?.[0]}{client.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-800 truncate">
                              {client.first_name} {client.last_name}
                            </p>
                            {client.email && (
                              <p className="text-xs text-stone-400 truncate max-w-[220px]">{client.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-stone-600 text-xs">{client.phone || '-'}</span>
                      </td>
                      <td className="p-4">
                        {stats.count > 0 ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700">
                              <Plane className="w-3 h-3" style={{ color: '#2E442A' }} />
                              {stats.count}
                            </span>
                            {stats.lastDate && (
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                último: {formatDate(stats.lastDate, 'd MMM yy', { locale: es })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-300">Sin viajes</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-semibold" style={{ color: stats.total > 0 ? '#16A34A' : '#D6D3D1' }}>
                          ${stats.total.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        {client.birth_date ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-stone-600 text-xs">
                              {formatDate(client.birth_date, 'd MMM', { locale: es })}
                            </span>
                            {bdaySoon && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full w-fit"
                                style={{ color: '#BE185D', background: 'rgba(219,39,119,0.1)' }}
                              >
                                <Cake className="w-3 h-3" />
                                {bdays === 0 ? '¡Hoy!' : bdays === 1 ? 'Mañana' : `en ${bdays} días`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={createPageUrl(`ClientDetail?id=${client.id}`)}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4 text-stone-400" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingClient(client); setFormOpen(true); }}>
                            <Edit2 className="w-4 h-4 text-stone-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirm(client)}>
                            <Trash2 className="w-4 h-4 text-stone-400 hover:text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Share client intake form */}
      <ShareClientFormModal open={shareOpen} onClose={() => setShareOpen(false)} />

      {/* Form Dialog */}
      <ClientForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingClient(null); }}
        client={editingClient}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente a{' '}
              <strong>{deleteConfirm?.first_name} {deleteConfirm?.last_name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
