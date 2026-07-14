'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Mic, Search, Users, ChevronRight } from 'lucide-react';
import type { InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getInterviewResponsesMatrix, getProjects, getQuestions } from '@/lib/api';
import { analyzeProvider, buildProviders } from '@/lib/providerAnalysis';
import { providerDetailHref } from '@/lib/providerSlug';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

export default function ProvidersListPage() {
  const { projectId, setProjectId, hydrated } = useProjectContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [matrix, setMatrix] = useState<InterviewResponsesMatrix | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('projectId');
    getProjects()
      .then((p) => {
        setProjects(p);
        if (pid) {
          const id = parseInt(pid, 10);
          if (Number.isFinite(id)) setProjectId(id);
        }
      })
      .catch(() => {});
  }, [setProjectId]);

  useEffect(() => {
    if (!hydrated || projects.length === 0 || projectId) return;
    const id = pickDefaultProjectId(projects);
    if (id) setProjectId(id);
  }, [hydrated, projects, projectId, setProjectId]);

  const load = useCallback(async (pid: number) => {
    setLoading(true);
    setError(null);
    try {
      const [q, m] = await Promise.all([
        getQuestions(pid),
        getInterviewResponsesMatrix({ projectId: pid }),
      ]);
      setQuestions(q);
      setMatrix(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (projectId) void load(projectId); }, [projectId, load]);

  const providers = useMemo(() => {
    if (!matrix) return [];
    const list = buildProviders(matrix);
    const q = search.trim().toLowerCase();
    return q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
  }, [matrix, search]);

  const analyses = useMemo(
    () => providers.map((p) => analyzeProvider(p, questions)),
    [providers, questions],
  );

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-emerald-500/50 to-transparent" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Módulo Ficha</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Detalle por proveedor
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Propuestas + entrevistas unificadas — vista consolidada y evidencias
          </p>
        </div>
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">⚠ {error}</div>
      )}

      {!projectId && !loading && (
        <div className="glass rounded-2xl p-16 text-center">
          <Users className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-lg">Selecciona un proyecto para comenzar</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          Cargando proveedores...
        </div>
      )}

      {!loading && projectId && (
        <div className="animate-fade-in space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
          </div>

          {providers.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-slate-400">Sin proveedores en este proyecto</p>
            </div>
          )}

          <div className="grid gap-3">
            {analyses.map((a) => {
              const { provider, combinedPct } = a;
              const pctColor = combinedPct >= 80 ? 'text-emerald-400' : combinedPct >= 50 ? 'text-yellow-400' : 'text-rose-400';
              const pctBg = combinedPct >= 80 ? 'bg-emerald-500' : combinedPct >= 50 ? 'bg-yellow-500' : 'bg-rose-500';
              const href = providerDetailHref(provider.name, projectId ?? undefined);

              return (
                <Link
                  key={provider.name}
                  href={href}
                  className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-500/25 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center text-white font-bold shrink-0">
                    {provider.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate group-hover:text-emerald-200 transition-colors">
                      {provider.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                      {provider.proposals.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <FileText className="w-3 h-3" />
                          {provider.proposals.length} propuesta{provider.proposals.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {provider.interviews.length > 0 && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Mic className="w-3 h-3" />
                          {provider.interviews.length} entrevista{provider.interviews.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pctBg}`} style={{ width: `${combinedPct}%` }} />
                      </div>
                      <span className={`text-xs font-mono font-bold ${pctColor}`}>{combinedPct}%</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
