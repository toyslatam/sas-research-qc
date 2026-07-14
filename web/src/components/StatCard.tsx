import { type LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: 'cyan' | 'violet' | 'emerald' | 'amber';
}

const accentMap = {
  cyan:    { bg: 'from-cyan-500/10 to-cyan-600/5',    icon: 'bg-cyan-500/15 text-cyan-400',    val: 'text-cyan-400',    border: 'border-cyan-500/20'    },
  violet:  { bg: 'from-violet-500/10 to-violet-600/5', icon: 'bg-violet-500/15 text-violet-400', val: 'text-violet-400', border: 'border-violet-500/20' },
  emerald: { bg: 'from-emerald-500/10 to-emerald-600/5', icon: 'bg-emerald-500/15 text-emerald-400', val: 'text-emerald-400', border: 'border-emerald-500/20' },
  amber:   { bg: 'from-amber-500/10 to-amber-600/5',  icon: 'bg-amber-500/15 text-amber-400',  val: 'text-amber-400',  border: 'border-amber-500/20'  },
};

export function StatCard({ title, value, subtitle, icon: Icon, accent = 'cyan' }: Props) {
  const a = accentMap[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${a.border} bg-gradient-to-br ${a.bg} shadow-card p-5 group hover:shadow-card-hover transition-all duration-300`}>
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className={`text-4xl font-bold mt-1.5 ${a.val} tabular-nums`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${a.icon} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
