'use client';

import { useMemo, useState } from 'react';
import { FileText, Mic, Layers, BarChart3 } from 'lucide-react';
import type { DashboardStats, InterviewResponsesMatrix, Question } from '@whispper/shared';
import type { ProviderAnalysis } from '@/lib/providerAnalysis';
import { toProviderSlug } from '@/lib/providerSlug';
import { ProviderConsolidatedPanel } from '@/components/provider/ProviderConsolidatedPanel';
import { ProviderFinalAnalysisPanel } from '@/components/provider/ProviderFinalAnalysisPanel';
import { InterviewResponsesSection } from '@/components/InterviewResponsesSection';

type DetailTab = 'consolidado' | 'propuestas' | 'entrevistas' | 'evidencias' | 'analisis_final';

const TABS: { id: DetailTab; label: string; icon: typeof Layers }[] = [
  { id: 'consolidado',     label: 'Vista consolidada', icon: Layers     },
  { id: 'propuestas',      label: 'Propuestas',        icon: FileText   },
  { id: 'entrevistas',     label: 'Entrevistas',       icon: Mic        },
  { id: 'evidencias',      label: 'Todas las evidencias', icon: Layers  },
  { id: 'analisis_final',  label: 'Análisis Final',    icon: BarChart3  },
];

function filterMatrix(
  matrix: InterviewResponsesMatrix,
  moduleType?: 'propuesta' | 'exploratorio',
): InterviewResponsesMatrix {
  if (!moduleType) return matrix;
  return {
    ...matrix,
    entrevistas: matrix.entrevistas.filter((e) => e.module_type === moduleType),
  };
}

export function ProviderDetailClient({
  analysis,
  matrix,
  questions,
  aggregated,
  projectId,
}: {
  analysis: ProviderAnalysis;
  matrix: InterviewResponsesMatrix;
  questions: Question[];
  aggregated: DashboardStats['respuestas_por_pregunta'];
  projectId?: number;
}) {
  const [tab, setTab] = useState<DetailTab>('consolidado');
  const { provider, combinedPct } = analysis;

  const pctColor = combinedPct >= 80 ? 'text-emerald-400' : combinedPct >= 50 ? 'text-yellow-400' : 'text-rose-400';

  const tabMatrix = useMemo(() => {
    if (tab === 'propuestas') return filterMatrix(matrix, 'propuesta');
    if (tab === 'entrevistas') return filterMatrix(matrix, 'exploratorio');
    return matrix;
  }, [matrix, tab]);

  const showResponses = tab === 'propuestas' || tab === 'entrevistas' || tab === 'evidencias';
  const accent = tab === 'propuestas' ? 'amber' as const : 'cyan' as const;
  const providerSlug = toProviderSlug(provider.name);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header stats */}
      <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center text-white text-xl font-bold shrink-0">
          {provider.name[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{provider.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
            {provider.proposals.length > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <FileText className="w-3.5 h-3.5" />
                {provider.proposals.length} propuesta{provider.proposals.length > 1 ? 's' : ''}
              </span>
            )}
            {provider.interviews.length > 0 && (
              <span className="flex items-center gap-1 text-cyan-400">
                <Mic className="w-3.5 h-3.5" />
                {provider.interviews.length} entrevista{provider.interviews.length > 1 ? 's' : ''}
              </span>
            )}
            <span className={`font-bold ${pctColor}`}>{combinedPct}% cobertura combinada</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="glass rounded-2xl p-1.5 flex flex-wrap gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl font-medium transition-all ${
              tab === id
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'consolidado' && (
        <div className="glass rounded-2xl p-5">
          <ProviderConsolidatedPanel analysis={analysis} />
        </div>
      )}

      {tab === 'analisis_final' && projectId != null && (
        <ProviderFinalAnalysisPanel
          projectId={projectId}
          providerName={provider.name}
          providerSlug={providerSlug}
        />
      )}

      {tab === 'analisis_final' && projectId == null && (
        <div className="glass rounded-2xl p-12 text-center text-slate-500 text-sm">
          Selecciona un proyecto para ver el análisis final.
        </div>
      )}

      {showResponses && (
        tabMatrix.entrevistas.length > 0
          ? (
            <InterviewResponsesSection
              matrix={tabMatrix}
              aggregated={aggregated}
              projectId={projectId}
              questions={questions}
              sectionId={`provider-${tab}`}
              accent={tab === 'evidencias' ? 'cyan' : accent}
            />
          )
          : (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-slate-500 text-sm">
                {tab === 'propuestas'
                  ? 'Este proveedor no tiene propuestas cargadas.'
                  : tab === 'entrevistas'
                    ? 'Este proveedor no tiene entrevistas exploratorias.'
                    : 'Sin evidencias para este proveedor.'}
              </p>
            </div>
          )
      )}
    </div>
  );
}
