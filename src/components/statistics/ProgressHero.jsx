import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { DollarSign, TrendingUp, Plane, Receipt, Target, Percent, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import StatCard from './StatCard';
import FunnelChart from '@/components/dashboard/FunnelChart';

const money = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const pctTrend = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : 0);

const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = parseLocalDate(String(dateStr).split('T')[0]);
  return d ? isWithinInterval(d, { start, end }) : false;
};

function GoalBar({ label, actual, goal, color }) {
  const pct = goal > 0 ? Math.min(100, (actual / goal) * 100) : 0;
  const done = goal > 0 && actual >= goal;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="font-medium text-stone-600">{label}</span>
        <span className="text-stone-500">
          <strong className="text-stone-800">{money(actual)}</strong>{goal > 0 ? ` / ${money(goal)}` : ''}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[11px] text-stone-400 mt-1">
        {goal > 0 ? (done ? '¡Meta superada! 🎉' : `Faltan ${money(goal - actual)} · ${Math.round(pct)}%`) : 'Sin meta definida'}
      </p>
    </div>
  );
}

export default function ProgressHero({
  soldTrips = [],
  services = [],
  trips = [],
  salesGoal,
  commissionGoal,
  canEditGoals = false,
  showGoals = true,
  onSaveGoals,
  savingGoals = false,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [sVal, setSVal] = useState('');
  const [cVal, setCVal] = useState('');

  const m = useMemo(() => {
    const now = new Date();
    const curStart = startOfMonth(now);
    const curEnd = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));

    const curTrips = soldTrips.filter(t => inRange(t.created_date, curStart, curEnd));
    const prevTrips = soldTrips.filter(t => inRange(t.created_date, prevStart, prevEnd));

    const sumPrice = (list) => list.reduce((s, t) => s + (t.total_price || 0), 0);
    const curIds = new Set(curTrips.map(t => t.id));
    const prevIds = new Set(prevTrips.map(t => t.id));
    const sumComm = (idSet) => services.reduce((s, sv) => (idSet.has(sv.sold_trip_id) ? s + (sv.commission || 0) : s), 0);

    const salesCur = sumPrice(curTrips);
    const salesPrev = sumPrice(prevTrips);
    const commCur = sumComm(curIds);
    const commPrev = sumComm(prevIds);
    const ticketCur = curTrips.length > 0 ? salesCur / curTrips.length : 0;
    const ticketPrev = prevTrips.length > 0 ? salesPrev / prevTrips.length : 0;

    const conversion = trips.length > 0 ? Math.round((soldTrips.length / trips.length) * 100) : 0;

    return {
      salesCur, salesTrend: pctTrend(salesCur, salesPrev),
      commCur, commTrend: pctTrend(commCur, commPrev),
      tripsCur: curTrips.length, tripsTrend: pctTrend(curTrips.length, prevTrips.length),
      ticketCur, ticketTrend: pctTrend(ticketCur, ticketPrev),
      conversion,
    };
  }, [soldTrips, services, trips]);

  const hasGoals = (salesGoal && salesGoal > 0) || (commissionGoal && commissionGoal > 0);

  const openEdit = () => {
    setSVal(salesGoal ? String(salesGoal) : '');
    setCVal(commissionGoal ? String(commissionGoal) : '');
    setEditOpen(true);
  };
  const handleSave = () => {
    onSaveGoals?.(Math.round(parseFloat(sVal) || 0), Math.round(parseFloat(cVal) || 0));
    setEditOpen(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: 'Playfair Display, serif' }}>
        Resumen de este mes
      </h2>

      {/* KPIs con tendencia vs mes anterior */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} value={money(m.salesCur)} label="Ventas del mes" trend={m.salesTrend} />
        <StatCard icon={TrendingUp} value={money(m.commCur)} label="Comisiones del mes" trend={m.commTrend} iconBg="#C9A84C1f" iconColor="#A98C3D" />
        <StatCard icon={Plane} value={m.tripsCur} label="Viajes vendidos" trend={m.tripsTrend} iconBg="#3B82F618" iconColor="#3B82F6" />
        <StatCard icon={Receipt} value={money(m.ticketCur)} label="Ticket promedio" trend={m.ticketTrend} iconBg="#8B5CF618" iconColor="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Metas del mes */}
        {showGoals && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: '#2E442A' }} /> Metas del mes
              </h3>
              {canEditGoals && (
                <button onClick={openEdit} className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800">
                  <Pencil className="w-3.5 h-3.5" /> Editar metas
                </button>
              )}
            </div>

            {!hasGoals ? (
              <div className="text-center py-6">
                <Target className="w-9 h-9 mx-auto mb-2 text-stone-200" />
                {canEditGoals ? (
                  <>
                    <p className="text-sm text-stone-500 mb-3">Define tus metas del mes para ver tu progreso.</p>
                    <Button onClick={openEdit} size="sm" className="rounded-lg text-white" style={{ backgroundColor: '#2E442A' }}>
                      Definir metas
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-stone-400">Sin metas definidas</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <GoalBar label="Ventas" actual={m.salesCur} goal={salesGoal || 0} color="#2E442A" />
                <GoalBar label="Comisión" actual={m.commCur} goal={commissionGoal || 0} color="#C9A84C" />
              </div>
            )}
          </div>
        )}

        {/* Conversión + pipeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-800 flex items-center gap-2">
              <Percent className="w-4 h-4" style={{ color: '#2E442A' }} /> Conversión
            </h3>
            <div className="text-right">
              <p className="text-2xl font-bold text-stone-800 leading-none">{m.conversion}%</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{soldTrips.length} vendidos de {trips.length} cotizaciones</p>
            </div>
          </div>
          <FunnelChart trips={trips} />
        </div>
      </div>

      {/* Modal de edición de metas */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#2E442A' }}>
              <Target className="w-5 h-5" /> Metas del mes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-stone-500">Meta de ventas (USD)</Label>
              <Input type="number" value={sVal} onChange={(e) => setSVal(e.target.value)} placeholder="Ej. 500000" className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-xs text-stone-500">Meta de comisión (USD)</Label>
              <Input type="number" value={cVal} onChange={(e) => setCVal(e.target.value)} placeholder="Ej. 40000" className="mt-1.5 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSave} disabled={savingGoals} className="rounded-lg text-white" style={{ backgroundColor: '#2E442A' }}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
