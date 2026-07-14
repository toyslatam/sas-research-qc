'use client';

import Link from 'next/link';
import { ArrowRight, CircleDot } from 'lucide-react';
import type { ResolvedModule } from '@/platform/types/module';
import { accentStyles } from '@/platform/utils/accents';
import { getModuleIcon } from '@/platform/utils/icons';

interface ModuleCardProps {
  module: ResolvedModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const Icon = getModuleIcon(module.icon);
  const accent = accentStyles[module.accent];
  const isActive = module.status === 'active';
  const statusText =
    module.status === 'active'
      ? 'Activo'
      : module.status === 'coming_soon'
        ? 'Próximamente'
        : 'Deshabilitado';
  const countText = `${module.itemCount ?? 0} ${module.itemLabel ?? 'elementos'}`;

  const content = (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-7 transition-all duration-300 animate-slide-up min-h-[300px] flex flex-col ${
        isActive
          ? `${accent.border} hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer`
          : 'border-[var(--border-subtle)] opacity-70 cursor-not-allowed'
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${accent.bg} ${accent.border}`}
          >
            <Icon className={`w-6 h-6 ${accent.text}`} />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            <CircleDot className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-amber-400'}`} />
            {statusText}
          </span>
        </div>

        <h3 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] mb-2">
          {module.name}
        </h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5 line-clamp-3 min-h-[64px]">
          {module.description}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-6 text-xs">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-2">
            <p className="text-[var(--text-muted)]">Color</p>
            <p className={`font-medium ${accent.text}`}>{module.accent}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-2">
            <p className="text-[var(--text-muted)]">Estado</p>
            <p className="font-medium text-[var(--text-primary)]">{statusText}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-2">
            <p className="text-[var(--text-muted)]">Cantidad</p>
            <p className="font-medium text-[var(--text-primary)] truncate">{countText}</p>
          </div>
        </div>

        <div className="mt-auto">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              isActive
                ? `${accent.text} ${accent.border} ${accent.bg} group-hover:translate-x-0.5`
                : 'text-[var(--text-muted)] border-[var(--border-subtle)] bg-[var(--bg-hover)]'
            }`}
          >
            {isActive ? 'Entrar' : 'No disponible'}
            {isActive && <ArrowRight className="w-4 h-4" />}
          </span>
        </div>
      </div>
    </article>
  );

  if (!isActive) return content;

  return (
    <Link href={module.href} className="block">
      {content}
    </Link>
  );
}
