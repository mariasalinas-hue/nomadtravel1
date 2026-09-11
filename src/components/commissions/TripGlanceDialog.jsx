import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Hotel, Plane, Car, Compass, Ship, Train, Briefcase, Package, Check, AlertTriangle, Clock, Plus, Trash2, ExternalLink } from 'lucide-react';

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const DEFAULT_AGENT_RATE = 50;

const SERVICE_ICONS = { hotel: Hotel, vuelo: Plane, traslado: Car, tour: Compass, crucero: Ship, tren: Train, dmc: Briefcase, otro: Package };
const SERVICE_ICON_COLORS = {
  hotel: 'bg-rose-50 text-rose-500', vuelo: 'bg-sky-50 text-sky-500', traslado: 'bg-amber-50 text-amber-500',
  tour: 'bg-emerald-50 text-emerald-500', crucero: 'bg-cyan-50 text-cyan-500', tren: 'bg-pink-50 text-pink-500',
  dmc: 'bg-indigo-50 text-indigo-500', otro: 'bg-stone-100 text-stone-500',
};

const STAGE_META = {
  proximas:        { label: 'Estimada',      cls: 'bg-violet-50 text-violet-600' },
  por_cobrar:      { label: 'Por cobrar',    cls: 'bg-orange-50 text-orange-600' },
  pagadas_agencia: { label: 'Por confirmar', cls: 'bg-amber-50 text-amber-600' },
  confirmadas:     { label: 'Por pagar',     cls: 'bg-blue-50 text-blue-600' },
  pagadas:         { label: 'Pagada',        cls: 'bg-green-50 text-green-600' },
};
const STAGE_ORDER = ['proximas', 'por_cobrar', 'pagadas_agencia', 'confirmadas', 'pagadas'];
const SETTLED_STAGES = ['pagadas_agencia', 'confirmadas', 'pagadas'];

const getServiceName = (service) => {
  const m = service.metadata || {};
  switch (service.service_type) {
    case 'hotel': return service.hotel_name || m.hotel_name || service.service_name || service.hotel_chain || m.hotel_chain || 'Hotel';
    case 'vuelo': return service.airline || m.airline || service.service_name || 'Vuelo';
    case 'traslado': {
      const o = service.transfer_origin || m.transfer_origin || '';
      const d = service.transfer_destination || m.transfer_destination || '';
      return (o || d) ? `${o} → ${d}` : (service.service_name || 'Traslado');
    }
    case 'tour': return service.tour_name || m.tour_name || service.service_name || 'Tour';
    case 'crucero': return service.cruise_ship || m.cruise_ship || service.cruise_line || m.cruise_line || service.service_name || 'Crucero';
    case 'tren': return `${service.train_operator || m.train_operator || 'Tren'} ${service.train_number || m.train_number || ''}`.trim() || service.service_name || 'Tren';
    case 'dmc': return service.dmc_name || m.dmc_name || service.service_name || 'DMC';
    case 'otro': return service.other_name || m.other_name || service.other_description || m.other_description || service.service_name || 'Servicio';
    default: return service.service_name || 'Servicio';
  }
};

// Estado de conciliación de un viaje: ¿la NETA cuadra con lo que quedó en la cuenta?
// - sin_clasificar: hay comisión sin marcar neto/bruto (no se puede verificar).
// - en_proceso: aún no se mueve todo el dinero (etapas tempranas) → no se marca error.
// - no_cuadra: ya debería estar cuadrado pero neta ≠ saldo.
// - ok: cuadra (o no hay neta que conciliar).
export function reconStatus(fin, tripRows = []) {
  const f = fin || { gross: 0, net: 0, unclassified: 0, clientIn: 0, nomadOut: 0, saldo: 0 };
  if ((f.unclassified || 0) > 0) {
    return { key: 'sin_clasificar', label: 'Falta clasificar', color: 'amber',
      msg: `Hay ${money(f.unclassified)} de comisión sin marcar neto/bruto. Clasifícalo para poder verificar que cuadre.` };
  }
  if ((f.net || 0) <= 0) return { key: 'ok', label: 'Cuadra', color: 'emerald', msg: 'No hay comisión neta que conciliar.' };
  const settled = tripRows.length > 0 && tripRows.every(r => SETTLED_STAGES.includes(r.stage));
  if (!settled) {
    return { key: 'en_proceso', label: 'En proceso', color: 'stone',
      msg: 'Aún faltan pagos por registrarse; la conciliación se verifica cuando el viaje esté cobrado y pagado.' };
  }
  const diff = (f.saldo || 0) - (f.net || 0);
  if (Math.abs(diff) < 1) {
    return { key: 'ok', label: 'Cuadra', color: 'emerald',
      msg: `La neta (${money(f.net)}) coincide con lo que quedó en la cuenta.` };
  }
  return { key: 'no_cuadra', label: 'No cuadra', color: 'red',
    msg: `La neta esperada es ${money(f.net)} pero en la cuenta quedaron ${money(f.saldo)} (diferencia ${money(Math.abs(diff))}). Revisa un pago de cliente/proveedor o el tipo de algún servicio.` };
}

export default function TripGlanceDialog({ open, onClose, trip, tripRows = [], fin, onSaveDeductions, onSetType, saving }) {
  const [newConcept, setNewConcept] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const canEditDeductions = typeof onSaveDeductions === 'function';
  const canEditType = typeof onSetType === 'function';

  const totalCommission = tripRows.reduce((s, r) => s + (r.service.commission || 0), 0);
  const totalAgent = tripRows.reduce((s, r) => s + (r.split?.agent || 0), 0);
  const byStage = STAGE_ORDER.map(k => {
    const list = tripRows.filter(r => r.stage === k);
    return { key: k, ...STAGE_META[k], count: list.length, agent: list.reduce((s, r) => s + (r.split?.agent || 0), 0) };
  });
  const paidAgent = byStage.find(s => s.key === 'pagadas')?.agent || 0;
  const pendingAgent = Math.max(0, totalAgent - paidAgent);
  const paidPct = totalAgent > 0 ? Math.round((paidAgent / totalAgent) * 100) : 0;
  const f = fin || { gross: 0, net: 0, unclassified: 0, clientIn: 0, nomadOut: 0, saldo: 0 };
  const recon = reconStatus(f, tripRows);
  const reconTone = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    stone: 'bg-stone-50 border-stone-200 text-stone-500',
  }[recon.color];

  const refDate = trip?.end_date || trip?.start_date;
  const agentName = tripRows[0]?.agentName;
  const agentRate = tripRows[0]?.agentRate ?? DEFAULT_AGENT_RATE;

  const deductions = trip?.metadata?.commission_deductions || [];
  const totalDeductions = deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const netAgent = totalAgent - totalDeductions;

  const addDeduction = () => {
    const amount = Math.round(parseFloat(newAmount) || 0);
    if (!trip?.id || amount <= 0) return;
    const entry = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      concept: newConcept.trim() || 'Deducción', amount, date: new Date().toISOString().split('T')[0],
    };
    onSaveDeductions(trip.id, [...deductions, entry]);
    setNewConcept(''); setNewAmount('');
  };
  const removeDeduction = (id) => { if (trip?.id) onSaveDeductions(trip.id, deductions.filter(d => d.id !== id)); };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: '#2E442A' }}>
            {trip ? `${trip.client_name || 'Viaje'}${trip.destination ? ' · ' + trip.destination : ''}` : 'Viaje'}
          </DialogTitle>
          <p className="text-sm text-stone-400">
            {trip?.trip_name ? `${trip.trip_name} · ` : ''}
            {refDate ? formatDate(refDate, "d 'de' MMMM yyyy", { locale: es }) : 'Sin fecha'}
            {agentName ? ` · ${agentName} (${agentRate}%)` : ''}
            {trip?.file_number ? ` · Exp. ${trip.file_number}` : ''}
          </p>
        </DialogHeader>

        {/* Estado de conciliación */}
        <div className={`rounded-xl border px-3 py-2 flex items-start gap-2 ${reconTone}`}>
          {recon.key === 'ok' ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : recon.key === 'en_proceso' ? <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">{recon.label}</p>
            <p className="text-[11px] leading-tight opacity-90">{recon.msg}</p>
          </div>
        </div>

        {/* Comisión total del viaje, partida por tipo */}
        <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Comisión total <span className="text-stone-300 normal-case">(todo el viaje)</span></p>
            <p className="text-2xl font-bold text-stone-800">{money(totalCommission)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-green-50 border border-green-100 px-2.5 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-green-500">Neta</p>
              <p className="text-sm font-bold text-green-700">{money(f.net)}</p>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Bruta</p>
              <p className="text-sm font-bold text-orange-600">{money(f.gross)}</p>
            </div>
            <div className={`rounded-lg border px-2.5 py-1.5 ${f.unclassified > 0 ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-100'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${f.unclassified > 0 ? 'text-amber-600' : 'text-stone-300'}`}>Sin clasificar</p>
              <p className={`text-sm font-bold ${f.unclassified > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{money(f.unclassified)}</p>
            </div>
          </div>
        </div>

        {/* Pago al agente (todo el viaje): pagado vs pendiente */}
        <div className="rounded-xl border p-3" style={{ borderColor: '#2E442A22', backgroundColor: '#2E442A08' }}>
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pago al agente <span className="text-stone-300 normal-case">(todo el viaje)</span></p>
            <p className="text-lg font-bold" style={{ color: '#2E442A' }}>{money(totalAgent)}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${paidPct}%`, backgroundColor: '#2E442A' }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px]">
            <span className="text-stone-500">Ya pagado: <strong className="text-stone-700">{money(paidAgent)}</strong></span>
            <span className="text-stone-500">Pendiente: <strong className="text-stone-700">{money(pendingAgent)}</strong></span>
          </div>
          {totalDeductions > 0 && (
            <p className="text-[10px] text-stone-500 mt-1 pt-1 border-t border-stone-200">
              − Deducciones {money(totalDeductions)} · <strong>Neto total a pagar {money(netAgent)}</strong>
            </p>
          )}
        </div>

        {/* Pipeline de etapas */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">En qué etapa está</p>
          <div className="grid grid-cols-5 gap-1.5">
            {byStage.map(s => (
              <div key={s.key} className={`rounded-lg px-1.5 py-2 text-center ${s.count > 0 ? s.cls : 'bg-stone-50 text-stone-300'}`}>
                <p className="text-lg font-bold leading-none">{s.count}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide mt-1 leading-tight">{s.label}</p>
                {s.count > 0 && <p className="text-[9px] mt-0.5 opacity-80">{money(s.agent)}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Neta que se quedó en la cuenta */}
        <div className={`rounded-xl border px-3 py-2.5 ${recon.key === 'ok' && f.net > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Neta que se quedó en la cuenta <span className="text-stone-300 normal-case">(todo el viaje)</span>
            </p>
            <span className="text-[10px] text-stone-400">esperado (neta): {money(f.net)}</span>
          </div>
          <p className={`text-xl font-bold ${f.saldo < 0 ? 'text-red-600' : 'text-stone-800'}`}>{money(f.saldo)}</p>
          <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
            Cliente pagó {money(f.clientIn)} − Nomad pagó a proveedores {money(f.nomadOut)}. Es la comisión neta que se queda en la agencia por pagar los servicios en neto.
          </p>
        </div>

        {/* Deducciones */}
        {(canEditDeductions || deductions.length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Deducciones (parte agente)</p>
              {totalDeductions > 0 && <p className="text-xs font-semibold text-red-600">− {money(totalDeductions)}</p>}
            </div>
            <div className="rounded-xl border border-stone-100 divide-y divide-stone-100">
              {deductions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-stone-400">Sin deducciones</p>
              ) : deductions.map(d => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-stone-700 truncate">{d.concept || 'Deducción'}</p>
                    {d.date && <p className="text-[10px] text-stone-400">{formatDate(d.date, 'd MMM yy', { locale: es })}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-red-600">− {money(Number(d.amount) || 0)}</span>
                    {canEditDeductions && (
                      <button onClick={() => removeDeduction(d.id)} disabled={saving} title="Quitar" className="p-1 rounded text-stone-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {canEditDeductions && (
              <div className="flex gap-2 mt-2">
                <Input placeholder="Concepto (ej. anticipo, gasto)" value={newConcept} onChange={(e) => setNewConcept(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addDeduction(); }} className="flex-1 rounded-lg h-9" />
                <Input type="number" placeholder="Monto" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addDeduction(); }} className="w-28 rounded-lg h-9 text-right" />
                <Button onClick={addDeduction} disabled={saving || !(parseFloat(newAmount) > 0)} className="rounded-lg h-9 text-white flex-shrink-0" style={{ backgroundColor: '#2E442A' }}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Lista de servicios con su etapa (tipo editable) */}
        <div className="rounded-xl border border-stone-100 overflow-hidden">
          {tripRows.length === 0 ? (
            <p className="p-4 text-center text-sm text-stone-400">Sin comisiones</p>
          ) : tripRows.map(r => {
            const s = r.service;
            const Icon = SERVICE_ICONS[s.service_type] || Package;
            const iconColors = SERVICE_ICON_COLORS[s.service_type] || SERVICE_ICON_COLORS.otro;
            const meta = STAGE_META[r.stage] || { label: r.stage, cls: 'bg-stone-100 text-stone-500' };
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 border-t border-stone-100 first:border-t-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{getServiceName(s)}</p>
                  {canEditType ? (
                    <select value={s.payment_type || 'sin'} onChange={(e) => onSetType(s, e.target.value)} disabled={saving}
                      className={`mt-0.5 text-[10px] font-bold rounded px-1 py-0.5 border cursor-pointer focus:outline-none ${
                        s.payment_type === 'neto' ? 'text-green-700 border-green-200 bg-green-50'
                          : s.payment_type === 'bruto' ? 'text-orange-600 border-orange-200 bg-orange-50'
                            : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
                      <option value="neto">NETO</option>
                      <option value="bruto">BRUTO</option>
                      <option value="sin">SIN TIPO</option>
                    </select>
                  ) : (
                    <p className="text-[10px] text-stone-400">{s.payment_type ? s.payment_type.toUpperCase() : 'SIN TIPO'}</p>
                  )}
                </div>
                <div className="text-right w-20 flex-shrink-0">
                  <p className="text-sm font-semibold text-stone-700">{money(s.commission || 0)}</p>
                  <p className="text-[10px] text-stone-400">Ag. {money(r.split?.agent || 0)}</p>
                </div>
                <span className={`text-[9px] font-bold tracking-wide px-2 py-1 rounded-md flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
              </div>
            );
          })}
        </div>

        {trip?.id && (
          <div className="flex justify-end">
            <Link to={createPageUrl(`SoldTripDetail?id=${trip.id}`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
              <ExternalLink className="w-4 h-4" /> Abrir viaje completo
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
