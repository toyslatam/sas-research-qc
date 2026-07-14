'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Mic } from 'lucide-react';
import type { InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getDashboardStats, getInterviewResponsesMatrix, getProjects, getQuestions } from '@/lib/api';
import { analyzeProvider, buildProviders } from '@/lib/providerAnalysis';
import { findProviderBySlug } from '@/lib/providerSlug';
import { ProviderDetailClient } from '@/components/ProviderDetailClient';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

function matrixForProvider(
  matrix: InterviewResponsesMatrix,
  ids: Set<number>,
): InterviewResponsesMatrix {
  return {
    ...matrix,
    entrevistas: matrix.entrevistas.filter((e) => ids.has(e.id)),
  };
}

export default function ProviderDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { projectId, setProjectId, hydrated } = useProjectContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allMatrix, setAllMatrix] = useState<InterviewResponsesMatrix | null>(null);
  const [aggregated, setAggregated] = useState<Awaited<ReturnType<typeof getDashboardStats>>['respuestas_por_pregunta']>([]);
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
      const [q, matrix, stats] = await Promise.all([
        getQuestions(pid),
        getInterviewResponsesMatrix({ projectId: pid }),
        getDashboardStats({ projectId: pid }),
      ]);
      setQuestions(q);
      setAllMatrix(matrix);
      setAggregated(stats.respuestas_por_pregunta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (projectId) void load(projectId); }, [projectId, load]);

  const provider = useMemo(() => {
    if (!allMatrix) return null;
    return findProviderBySlug(buildProviders(allMatrix), slug) ?? null;
  }, [allMatrix, slug]);

  const analysis = useMemo(() => {
    if (!provider || !questions.length) return null;
    return analyzeProvider(provider, questions);
  }, [provider, questions]);

  const providerMatrix = useMemo(() => {
    if (!allMatrix || !provider) return null;
    const ids = new Set([...provider.proposals, ...provider.interviews].map((e) => e.id));
    return matrixForProvider(allMatrix, ids);
  }, [allMatrix, provider]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link
            href={projectId ? `/providers?projectId=${projectId}` : '/providers'}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al listado
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-emerald-500/50 to-transparent" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Ficha del proveedor</span>
          </div>
          <p className="text-slate-400 text-sm">
            Propuestas y entrevistas en una sola vista
          </p>
        </div>
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      </header>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">⚠ {error}</div>
      )}

      {!projectId && !loading && (
        <div className="glass rounded-2xl p-16 text-center">
          <p className="text-slate-400 font-medium text-lg">Selecciona un proyecto para ver la ficha</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          Cargando ficha...
        </div>
      )}

      {!loading && projectId && !provider && allMatrix && (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-slate-400 font-medium">Proveedor no encontrado en este proyecto</p>
          <Link href="/providers" className="text-emerald-400 text-sm mt-3 inline-block hover:underline">
            Ver todos los proveedores
          </Link>
        </div>
      )}

      {!loading && analysis && providerMatrix && provider && (
        <ProviderDetailClient
          analysis={analysis}
          matrix={providerMatrix}
          questions={questions}
          aggregated={aggregated}
          projectId={projectId ?? undefined}
        />
      )}

      {!loading && provider && allMatrix && (
        <div className="mt-8 pt-6 border-t border-white/[0.05] flex flex-wrap gap-3 text-xs">
          <span className="text-slate-600">Enlaces rápidos:</span>
          {provider.proposals.length > 0 && (
            <Link href={`/proposals${projectId ? `?projectId=${projectId}` : ''}`} className="text-amber-400 hover:underline flex items-center gap-1">
              <FileText className="w-3 h-3" /> Módulo propuestas
            </Link>
          )}
          {provider.interviews.length > 0 && (
            <Link href={`/exploratory${projectId ? `?projectId=${projectId}` : ''}`} className="text-cyan-400 hover:underline flex items-center gap-1">
              <Mic className="w-3 h-3" /> Módulo exploratorio
            </Link>
          )}
          <Link href={`/analysis${projectId ? `?projectId=${projectId}` : ''}`} className="text-violet-400 hover:underline">
            Análisis comparativo →
          </Link>
        </div>
      )}
    </main>
  );
}
