import { useState, useMemo } from 'react';
import { supabaseAPI } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Loader2, AlertCircle, Mail, Plus, Pencil, UserCheck, UserX, Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { isAdminEmail } from '@/config/adminEmails';

const DEFAULT_RATE = 50;
const RATE_PRESETS = [50, 55, 60, 100];
const rateOf = (u) => Number(u?.metadata?.agent_commission_rate) || DEFAULT_RATE;
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

export default function AdminAgents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // user o null (nuevo)
  const [form, setForm] = useState({ full_name: '', email: '', rate: DEFAULT_RATE, custom_role: '', is_active: true });

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => supabaseAPI.entities.User.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => supabaseAPI.entities.User.create(data),
    onSuccess: () => { invalidate(); setOpen(false); toast.success('Agente agregado'); },
    onError: (e) => {
      const dup = e?.code === '23505' || /duplicate|unique/i.test(e?.message || '');
      toast.error(dup ? 'Ya existe un usuario con ese correo' : `No se pudo agregar: ${e?.message || 'error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => supabaseAPI.entities.User.update(id, data),
    onSuccess: () => { invalidate(); setOpen(false); toast.success('Agente actualizado'); },
    onError: (e) => toast.error(`No se pudo actualizar: ${e?.message || 'error'}`),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', rate: DEFAULT_RATE, custom_role: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      full_name: u.full_name || '',
      email: u.email || '',
      rate: rateOf(u),
      custom_role: u.custom_role || '',
      is_active: u.is_active !== false,
    });
    setOpen(true);
  };

  const save = () => {
    const full_name = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const rate = Math.min(100, Math.max(1, Number(form.rate) || DEFAULT_RATE));
    if (!full_name) { toast.error('Escribe el nombre del agente'); return; }
    if (!isValidEmail(email)) { toast.error('Escribe un correo válido'); return; }

    if (editing) {
      const metadata = { ...(editing.metadata || {}), agent_commission_rate: rate };
      updateMutation.mutate({
        id: editing.id,
        data: { full_name, custom_role: form.custom_role || null, is_active: form.is_active, metadata },
      });
    } else {
      createMutation.mutate({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        email,
        full_name,
        role: 'user',
        custom_role: form.custom_role || null,
        is_active: true,
        metadata: { agent_commission_rate: rate },
      });
    }
  };

  const toggleActive = (u) => {
    updateMutation.mutate({ id: u.id, data: { is_active: u.is_active === false } });
  };

  const filtered = useMemo(() => {
    const list = [...users].sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  const saving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-stone-400" /></div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Error al cargar agentes: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
               style={{ background: 'linear-gradient(135deg, var(--nomad-green-light) 0%, var(--nomad-green) 100%)' }}>
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Agentes</h1>
            <p className="text-sm text-stone-500">Alta, edición y % de comisión de los agentes del CRM</p>
          </div>
        </div>
        <Button onClick={openNew} className="text-white rounded-xl self-start" style={{ backgroundColor: '#2E442A' }}>
          <Plus className="w-4 h-4 mr-2" /> Agregar agente
        </Button>
      </div>

      {/* Aviso login */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Dar de alta a un agente aquí lo registra en el CRM (aparece en comisiones, %, spoof, etc.).
          Para que además pueda <strong>iniciar sesión</strong>, el agente debe registrarse en el sistema de acceso (Clerk) usando <strong>el mismo correo</strong>.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Users className="w-4 h-4" />
        <span>{filtered.length} agente{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((u) => {
          const admin = isAdminEmail(u.email);
          const active = u.is_active !== false;
          const initials = (u.full_name || u.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div key={u.id || u.email} className={`bg-white rounded-xl border transition-all ${active ? 'border-stone-200 hover:shadow-md' : 'border-stone-200 opacity-60'}`}>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, var(--nomad-green-light) 0%, var(--nomad-green) 100%)' }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-stone-900 truncate">{u.full_name || 'Sin nombre'}</h3>
                      {admin && <Badge className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0">Admin</Badge>}
                      {u.custom_role === 'supervisor' && <Badge className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0">Supervisor</Badge>}
                      {!active && <Badge className="bg-stone-200 text-stone-600 text-xs px-1.5 py-0">Inactivo</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Mail className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                      <p className="text-sm text-stone-500 truncate">{u.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Percent className="w-4 h-4" style={{ color: '#2E442A' }} />
                    <span className="font-bold" style={{ color: '#2E442A' }}>{rateOf(u)}%</span>
                    <span className="text-stone-400 text-xs">comisión</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)} className="rounded-lg h-8">
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(u)} className="rounded-lg h-8"
                      title={active ? 'Desactivar' : 'Activar'}>
                      {active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">No se encontraron agentes</p>
        </div>
      )}

      {/* Modal alta/edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: '#2E442A' }}>{editing ? 'Editar agente' : 'Agregar agente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Nombre completo</label>
              <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ej. Frida Guzmán" />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">Correo</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="frida.guzman@nomadtravel.mx"
                disabled={!!editing}
              />
              {editing && <p className="text-[11px] text-stone-400 mt-1">El correo no se puede cambiar (es la llave con la que se enlazan sus viajes y login).</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1 block">% de comisión del agente</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={100} value={form.rate}
                  onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))} className="w-24 text-right" />
                <span className="text-stone-400">%</span>
                <div className="flex gap-1 ml-2">
                  {RATE_PRESETS.map(p => (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, rate: p }))}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border ${Number(form.rate) === p ? 'text-white' : 'text-stone-500 border-stone-200'}`}
                      style={Number(form.rate) === p ? { backgroundColor: '#2E442A', borderColor: '#2E442A' } : {}}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">El extra arriba de 50% sale de la parte de Nomad.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.custom_role === 'supervisor'}
                onChange={(e) => setForm(f => ({ ...f, custom_role: e.target.checked ? 'supervisor' : '' }))} />
              <span className="text-sm text-stone-600">Es supervisor</span>
            </label>
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span className="text-sm text-stone-600">Activo</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={save} disabled={saving} className="text-white rounded-xl" style={{ backgroundColor: '#2E442A' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Guardar' : 'Agregar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
