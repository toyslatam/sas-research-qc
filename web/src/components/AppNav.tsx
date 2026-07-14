'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FileText, Mic,
  BarChart3, Lightbulb, BookOpen, Layers, Eye,
} from 'lucide-react';

const modules = [
  { href: '/resumen',        label: 'Resumen',       icon: LayoutDashboard, accent: 'cyan'   },
  { href: '/participants', label: 'Proveedores',   icon: Users,           accent: 'violet' },
  { href: '/providers',    label: 'Ficha',         icon: Eye,             accent: 'emerald'},
  { href: '/proposals',   label: 'Propuestas',    icon: FileText,        accent: 'amber'  },
  { href: '/exploratory', label: 'Exploratorio',  icon: Mic,             accent: 'sky'    },
  { href: '/analysis',    label: 'Análisis',      icon: BarChart3,       accent: 'violet' },
  { href: '/insights',    label: 'Insights',      icon: Lightbulb,       accent: 'amber'  },
  { href: '/projects',    label: 'Cuestionario',  icon: BookOpen,        accent: 'slate'  },
] as const;

const accentActive: Record<string, string> = {
  cyan:   'bg-cyan-500/10   text-cyan-300   border-cyan-500/20',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  amber:  'bg-amber-500/10  text-amber-300  border-amber-500/20',
  sky:    'bg-sky-500/10    text-sky-300    border-sky-500/20',
  emerald:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  slate:  'bg-white/[0.06]  text-white      border-white/[0.1]',
};

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#050d1a]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-[52px] gap-1 overflow-x-auto scrollbar-hide">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm tracking-tight text-gradient hidden sm:block">Whispper</span>
        </Link>

        {/* Separator */}
        <div className="w-px h-5 bg-white/[0.08] shrink-0 mr-1" />

        {/* Module links */}
        {modules.map(({ href, label, icon: Icon, accent }) => {
          const active = href === '/resumen'
            ? pathname === '/resumen'
            : href === '/providers'
              ? pathname.startsWith('/providers')
              : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 font-medium border whitespace-nowrap shrink-0 ${
                active
                  ? accentActive[accent]
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:block">{label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        {/* Online badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">Online</span>
        </div>
      </div>
    </nav>
  );
}
