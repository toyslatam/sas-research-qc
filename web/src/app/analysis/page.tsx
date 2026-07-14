'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, FileText, Mic, CheckCircle2,
  Search, Users,
} from 'lucide-react';
import type { InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getDashboardStats, getInterviewResponsesMatrix, getProjects, getQuestions } from '@/lib/api';
import {
  analyzeProvider,
  averageCombinedCoverage,
  buildProviders,
} from '@/lib/providerAnalysis';
import { ProviderAnalysisCard } from '@/components/provider/ProviderConsolidatedPanel';
import { StatCard } from '@/components/StatCard';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

export default function AnalysisPage() {
  const { projectId, setProjectId, hydrated } = useProjectContext();
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allMatrix, setAllMatrix] = useState<InterviewResponsesMatrix | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [statsP,    setStatsP]    = useState(0);
  const [statsI,    setStatsI]    = useState(0);
  const [search,    setSearch]    = useState('');
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    getProjects()
      .then((p) => { setProjects(p); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated || projects.length === 0 || projectId) return;
    const id = pickDefaultProjectId(projects);
    if (id) setProjectId(id);
  }, [hydrated, projects, projectId, setProjectId]);

  const load = useCallback(async (pid: number) => {
    setLoading(true);
    setError(null);
    try {
      const [q, matrix, sp, si] = await Promise.all([
        getQuestions(pid),
        getInterviewResponsesMatrix({ projectId: pid }),
        getDashboardStats({ projectId: pid, moduleType: 'propuesta' }),
        getDashboardStats({ projectId: pid, moduleType: 'exploratorio' }),
      ]);
      setQuestions(q);
      setAllMatrix(matrix);
      setStatsP(sp.total_entrevistas);
      setStatsI(si.total_entrevistas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (projectId) void load(projectId); }, [projectId, load]);

  const providers = useMemo(
    () => (allMatrix ? buildProviders(allMatrix) : []),
    [allMatrix]
  );
  const analyses = useMemo(
    () => providers.map((p) => analyzeProvider(p, questions)),
    [providers, questions]
  );
  const filteredAnalyses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? analyses.filter((a) => a.provider.name.toLowerCase().includes(q)) : analyses;
  }, [analyses, search]);

  const avgCoverage    = averageCombinedCoverage(analyses);
  const withBothSources = analyses.filter(
    (a) => a.provider.proposals.length > 0 && a.provider.interviews.length > 0
  ).length;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-violet-500/50 to-transparent" />
            <span className="text-xs font-medium text-violet-400 uppercase tracking-widest">Módulo Análisis</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Análisis comparativo
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Propuesta + R1 + R2 + R3 — cobertura incremental y respuestas enriquecidas por fuente
          </p>
        </div>
        <ProjectSelect
          projects={projects}
          value={projectId}
          onChange={setProjectId}
        />
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">⚠ {error}</div>
      )}

      {!projectId && !loading && (
        <div className="glass rounded-2xl p-16 text-center">
          <BarChart3 className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-lg">Selecciona un proyecto para comenzar</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          Cargando análisis...
        </div>
      )}

      {!loading && projectId && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Propuestas"     value={statsP}            icon={FileText}     accent="amber"   />
            <StatCard title="Entrevistas"    value={statsI}            icon={Mic}          accent="cyan"    />
            <StatCard title="Proveedores"    value={providers.length}  icon={Users}        accent="violet"  />
            <StatCard title="Cobertura prom." value={`${avgCoverage}%`} icon={CheckCircle2} accent="emerald" />
          </div>

          {providers.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-xs text-slate-500">
                  {withBothSources} proveedor{withBothSources !== 1 ? 'es' : ''} con propuesta y entrevistas
                </p>
                <div className="relative flex-1 max-w-md sm:ml-auto">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar proveedor..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setExpandAll(!expandAll)}
                  className="text-xs text-slate-500 hover:text-violet-400 transition whitespace-nowrap"
                >
                  {expandAll ? '▲ Colapsar todos' : '▼ Expandir todos'}
                </button>
              </div>
            </div>
          )}

          {providers.length === 0 && (
            <div className="glass rounded-2xl p-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Sin datos en este proyecto</p>
            </div>
          )}

          {filteredAnalyses.length === 0 && providers.length > 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-slate-400">No hay proveedores que coincidan con &quot;{search}&quot;</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredAnalyses.map((a) => (
              <ProviderAnalysisCard
                key={a.provider.name}
                analysis={a}
                forceExpanded={expandAll}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
