'use client';

import { resolveModules } from '@/platform/registry';
import { ModuleCard } from '@/platform/launcher/ModuleCard';

export function ModuleLauncher() {
  const modules = resolveModules();
  const activeCount = modules.filter((m) => m.status === 'active').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
      <header className="mb-10 animate-fade-in">
        <p className="text-sm font-medium text-orange-400 mb-2">SAS RESEARCH QC</p>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
          Control de Calidad
        </h1>
        <p className="text-[var(--text-muted)] max-w-2xl text-base leading-relaxed">
          Plataforma de revisión de encuestas: reglas, evidencias, integraciones y reportes.
          Comparte el mismo Supabase que Whispper si así lo configuraste.
        </p>
        <div className="flex items-center gap-2 mt-4 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {activeCount} módulo(s) activo(s)
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
    </div>
  );
}
