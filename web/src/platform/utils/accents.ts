import type { ModuleAccent } from '@/platform/types/module';

export const accentStyles: Record<
  ModuleAccent,
  { bg: string; text: string; border: string; glow: string; gradient: string }
> = {
  cyan: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    glow: 'shadow-glow-cyan',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    glow: 'shadow-glow-violet',
    gradient: 'from-violet-500/20 to-violet-600/5',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    glow: 'shadow-glow-cyan',
    gradient: 'from-amber-500/20 to-amber-600/5',
  },
  sky: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    glow: 'shadow-glow-cyan',
    gradient: 'from-sky-500/20 to-sky-600/5',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'shadow-glow-cyan',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
  },
  slate: {
    bg: 'bg-white/[0.06]',
    text: 'text-slate-300',
    border: 'border-white/[0.1]',
    glow: '',
    gradient: 'from-white/10 to-white/5',
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    glow: 'shadow-glow-violet',
    gradient: 'from-rose-500/20 to-rose-600/5',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    glow: 'shadow-glow-cyan',
    gradient: 'from-orange-500/20 to-orange-600/5',
  },
};

export const navAccentActive: Record<ModuleAccent, string> = {
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  slate: 'bg-white/[0.06] text-white border-white/[0.1]',
  rose: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  orange: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
};
