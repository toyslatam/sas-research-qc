'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { whispperResearchModule } from '@/modules/whispper-research/config';
import { getModuleIcon } from '@/platform/utils/icons';
import { navAccentActive } from '@/platform/utils/accents';

export function ResearchModuleNav() {
  const pathname = usePathname();
  const base = whispperResearchModule.basePath;

  return (
    <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-navbar)]/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-[44px] gap-1 overflow-x-auto scrollbar-hide">
        {whispperResearchModule.nav.map(({ path, label, icon }) => {
          const href = `${base}/${path}`;
          const Icon = getModuleIcon(icon);
          const active =
            pathname === href ||
            (path === 'providers' && pathname.startsWith(`${base}/providers`));

          return (
            <Link
              key={path}
              href={href}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 font-medium border whitespace-nowrap shrink-0 ${
                active
                  ? navAccentActive[whispperResearchModule.accent]
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:block">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
