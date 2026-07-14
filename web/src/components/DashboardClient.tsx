'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Mic, BarChart3, Settings,
  TrendingUp, AlertTriangle, Users, ChevronRight,
} from 'lucide-react';
import type { DashboardStats, InterviewResponsesMatrix, Project } from '@whispper/shared';
import {
  getDashboardStats,
  getInterviewResponsesMatrix,
  getProjects,
  getWordCloud,
} from '@/lib/api';
import { buildProviders } from '@/lib/providerAnalysis';
import { providerDetailHref } from '@/lib/providerSlug';
import { isEmptyAnswer } from '@/lib/answers';
import { DashboardFilters } from './DashboardFilters';
import { StatCard } from './StatCard';
import { WordCloud } from './WordCloud';
import { usePersistedProjectFilters } from '@/hooks/usePersistedProjectFilters';
import {
  filterMatrixByProviders,
  gapQuestionsFromMatrix,
  gapQuestionsFromStats,
  wordCloudFromMatrix,
} from '@/lib/filterMatrix';

// ── Tabla de proveedores ───────────────────────────────────────────────────

function ProvidersTable({
  matrix,
  projectId,
}: {
  matrix: InterviewResponsesMatrix;
  projectId?: number;
}) {
  const router = useRouter();
  if (!matrix.entrevistas.length) return null;

  const providers = buildProviders(matrix);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-black/10">
            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-amber-500 uppercase tracking-wider">Propuesta</th>
            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Entrevista</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cobertura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {providers.map((provider) => {
            const proposals = provider.proposals.length;
            const interviews = provider.interviews.length;
            const allEvidences = [...provider.proposals, ...provider.interviews];
            const total = matrix.preguntas.length;
            const answered = matrix.preguntas.filter((q) =>
              allEvidences.some((e) => !isEmptyAnswer(e.respuestas[q])),
            ).length;
            const pct = total ? Math.round((answered / total) * 100) : 0;
            const href = providerDetailHref(provider.name, projectId);

            return (
              <tr
                key={provider.name}
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => router.push(href)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(href); }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center text-xs font-bold text-white">
                      {provider.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-slate-200 font-medium group-hover:text-emerald-200">{provider.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {proposals > 0
                    ? <span className="inline-flex items-center gap-1 text-xs text-amber-400"><FileText className="w-3 h-3" />{proposals}</span>
                    : <span className="text-slate-700">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {interviews > 0
                    ? <span className="inline-flex items-center gap-1 text-xs text-cyan-400"><Mic className="w-3 h-3" />{interviews}</span>
                    : <span className="text-slate-700">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-rose-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono font-bold ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-rose-400'}`}>
                      {pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Preguntas sin respuesta ────────────────────────────────────────────────

function GapAlerts({ questions }: { questions: string[] }) {
  const gaps = questions.slice(0, 5);
  if (!gaps.length) return null;

  return (
    <div className="space-y-2">
      {gaps.map((pregunta) => (
        <div key={pregunta} className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
          <span className="text-slate-400 leading-relaxed line-clamp-2">{pregunta}</span>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────

export function DashboardClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { filters, setFilters } = usePersistedProjectFilters({});
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [matrix,   setMatrix]   = useState<InterviewResponsesMatrix | null>(null);
  const [words,    setWords]    = useState<{ text: string; value: number }[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const apiFilters = useMemo(() => ({
    projectId: filters.projectId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    segment: filters.segment,
  }), [filters.projectId, filters.dateFrom, filters.dateTo, filters.segment]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s, m, w] = await Promise.all([
        getProjects(),
        getDashboardStats(apiFilters),
        getInterviewResponsesMatrix(apiFilters),
        getWordCloud({ projectId: apiFilters.projectId }),
      ]);
      setProjects(p);
      setStats(s);
      setMatrix(m);
      setWords(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard');
    } finally {
      setLoading(false);
    }
  }, [apiFilters]);

  useEffect(() => { load(); }, [load]);

  const providerOptions = useMemo(() => {
    if (!matrix) return [];
    return buildProviders(matrix).map((p) => p.name).sort((a, b) => a.localeCompare(b));
  }, [matrix]);

  useEffect(() => {
    const selected = filters.providers ?? [];
    if (!selected.length || !providerOptions.length) return;
    const valid = new Set(providerOptions);
    const pruned = selected.filter((n) => valid.has(n));
    if (pruned.length !== selected.length) {
      setFilters((f) => ({ ...f, providers: pruned.length ? pruned : undefined }));
    }
  }, [providerOptions, filters.providers, setFilters]);

  const filteredMatrix = useMemo(
    () => (matrix ? filterMatrixByProviders(matrix, filters.providers) : null),
    [matrix, filters.providers],
  );

  const displayWords = useMemo(() => {
    if (!filteredMatrix) return words;
    if (filters.providers?.length) return wordCloudFromMatrix(filteredMatrix);
    return words;
  }, [filteredMatrix, filters.providers, words]);

  const gapQuestions = useMemo(() => {
    if (filteredMatrix && filters.providers?.length) {
      return gapQuestionsFromMatrix(filteredMatrix);
    }
    if (stats) return gapQuestionsFromStats(stats);
    return [];
  }, [filteredMatrix, filters.providers, stats]);

  const effectiveProjectId = filters.projectId
    ?? (projects.length === 1 ? projects[0].id : undefined)
    ?? (matrix?.entrevistas.length
        ? projects.find(p => p.name === matrix.entrevistas[0].proyecto)?.id
        : undefined);

  const totalParticipants = filteredMatrix
    ? buildProviders(filteredMatrix).length
    : 0;

  const proposalCount = filteredMatrix?.entrevistas.filter((e) => e.module_type === 'propuesta').length ?? 0;
  const interviewCount = filteredMatrix?.entrevistas.filter((e) => e.module_type === 'exploratorio').length ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">

      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-cyan-500/50 to-transparent" />
            <span className="text-xs font-medium text-cyan-500 uppercase tracking-widest">Resumen del proyecto</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Dashboard</h1>
          <p className="text-slate-400 mt-2 text-sm">Vista ejecutiva — proveedores, cobertura y brechas</p>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-cyan-500/30 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all shrink-0"
        >
          <Settings className="w-4 h-4" />
          Cuestionario
        </Link>
      </header>

      <DashboardFilters
        projects={projects}
        filters={filters}
        onChange={setFilters}
        providerOptions={providerOptions}
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          Cargando...
        </div>
      )}

      {stats && !loading && (
        <div className="animate-fade-in space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Proveedores"
              value={totalParticipants}
              subtitle="Con evidencia cargada"
              icon={Users}
              accent="violet"
            />
            <StatCard
              title="Propuestas"
              value={proposalCount}
              icon={FileText}
              accent="amber"
            />
            <StatCard
              title="Entrevistas"
              value={interviewCount}
              icon={Mic}
              accent="cyan"
            />
            <StatCard
              title="Preguntas cubiertas"
              value={filteredMatrix?.preguntas.length ?? stats.respuestas_por_pregunta.length}
              icon={TrendingUp}
              accent="emerald"
            />
          </div>

          {/* Grid principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Proveedores (col wide) */}
            <div className="lg:col-span-2 glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  <h2 className="text-base font-semibold text-white">Proveedores del proyecto</h2>
                </div>
                <Link
                  href={effectiveProjectId ? `/providers?projectId=${effectiveProjectId}` : '/providers'}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                >
                  Ver detalle <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {filteredMatrix && filteredMatrix.entrevistas.length > 0
                ? <ProvidersTable matrix={filteredMatrix} projectId={effectiveProjectId} />
                : <p className="text-slate-500 text-sm">
                    {filters.providers?.length
                      ? 'Ningún proveedor coincide con la selección.'
                      : 'Carga propuestas o graba entrevistas para ver proveedores.'}
                  </p>}
            </div>

            {/* Panel derecho */}
            <div className="space-y-5">
              {/* Word cloud */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Palabras clave</h2>
                </div>
                <WordCloud words={displayWords} />
              </div>

              {/* Brechas */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h2 className="text-sm font-semibold text-white">Preguntas sin cubrir</h2>
                </div>
                {gapQuestions.length > 0
                  ? <GapAlerts questions={gapQuestions} />
                  : <p className="text-slate-600 text-xs">Sin brechas detectadas.</p>}
              </div>
            </div>
          </div>

          {/* CTA → Análisis */}
          <div className="glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Ver análisis comparativo</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Respuestas de todos los proveedores pregunta por pregunta
              </p>
            </div>
            <Link
              href={`/analysis`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition-all text-sm font-medium"
            >
              Ir al análisis <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
