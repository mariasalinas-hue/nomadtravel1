import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Tarjeta KPI compartida de la familia "statistics" (verde de marca por defecto).
// `trend` (número) pinta una flecha ↑/↓ con % vs el periodo anterior.
export default function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  iconBg = '#2E442A15',
  iconColor = '#2E442A',
  trend,
  trendLabel,
}) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
        </div>
        {hasTrend && (
          <span
            className="text-xs font-semibold flex items-center gap-0.5"
            style={{ color: trend >= 0 ? '#16A34A' : '#DC2626' }}
            title={trendLabel || 'vs mes anterior'}
          >
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-stone-800" style={{ letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}
