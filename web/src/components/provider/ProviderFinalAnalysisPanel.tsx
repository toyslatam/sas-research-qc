'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Loader2, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ProviderFinalAnalysis, FinalAnalysisItem } from '@whispper/shared';
import { generateFinalAnalysisDraft, getFinalAnalysis } from '@/lib/api';

const COVERAGE_LABELS: Record<string, string> = {
  sin_cobertura: 'Sin cobertura',
  solo_propuesta: 'Solo propuesta',
  solo_entrevista: 'Solo entrevista',
  coincide: 'Coincide',
  difiere: 'Difiere',
};

const RELEVANCE_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  alineada: 'Alineada',
  parcial: 'Parcial',
  desalineada: 'Desalineada',
  sin_dato: 'Sin dato',
};

function scoreColor(score: number | null): string {
  if (score == null) return 'text-slate-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-rose-400';
}

function truncate(text: string, max = 120): string {
  const t = text.trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function AnswerCell({ label, value }: { label: string; value: string }) {
  const empty = !value?.trim();
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className={`text-[11px] leading-snug whitespace-pre-wrap break-words ${empty ? 'text-slate-600 italic' : 'text-slate-300'}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

function AnalysisItemRow({ item, expanded, onToggle }: {
  item: FinalAnalysisItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cov = item.coverage_status ? COVERAGE_LABELS[item.coverage_status] ?? item.coverage_status : '—';
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 hover:bg-white/[0.02] transition-colors flex items-start gap-2"
      >
        <span className="text-[10px] font-mono text-violet-400 shrink-0 w-10 pt-0.5">{item.code}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-medium leading-snug">
            {item.sub_item_text ?? item.question_text}
          </p>
          {item.sub_item_text && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{item.question_text}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{item.category}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500">{cov}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500">
              {RELEVANCE_LABELS[item.relevance] ?? item.relevance}
            </span>
          </div>
          {!expanded && (
            <p className="text-[10px] text-slate-500 mt-1">
              Prop: {truncate(item.answer_propuesta, 60)} · R1: {truncate(item.answer_r1, 40)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold tabular-nums ${scoreColor(item.item_score)}`}>
            {item.item_score != null ? `${item.item_score}%` : '—'}
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-black/10">
          <AnswerCell label="Propuesta" value={item.answer_propuesta} />
          <AnswerCell label="R1 Exploratoria" value={item.answer_r1} />
          <AnswerCell label="R2 Cotización" value={item.answer_r2} />
          <AnswerCell label="R3 Clausura" value={item.answer_r3} />
          {item.synthesis && (
            <div className="sm:col-span-2 lg:col-span-4 border-t border-white/[0.04] pt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">Síntesis</p>
              <p className="text-[11px] text-slate-300 whitespace-pre-wrap">{item.synthesis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProviderFinalAnalysisPanel({
  projectId,
  providerName,
  providerSlug,
}: {
  projectId: number;
  providerName: string;
  providerSlug: string;
}) {
  const [analysis, setAnalysis] = useState<ProviderFinalAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFinalAnalysis(projectId, providerSlug);
      setAnalysis(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, providerSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    if (!analysis?.items.length) return [];
    return [...new Set(analysis.items.map((i) => i.category))].sort();
  }, [analysis]);

  const filteredItems = useMemo(() => {
    if (!analysis) return [];
    if (!filterCategory) return analysis.items;
    return analysis.items.filter((i) => i.category === filterCategory);
  }, [analysis, filterCategory]);

  const stats = useMemo(() => {
    if (!analysis) return null;
    const withData = analysis.items.filter(
      (i) => i.answer_propuesta.trim() || i.answer_r1.trim() || i.answer_r2.trim() || i.answer_r3.trim(),
    );
    const scored = analysis.items.filter((i) => i.item_score != null);
    return {
      total: analysis.items.length,
      withEvidence: withData.length,
      scored: scored.length,
    };
  }, [analysis]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateFinalAnalysisDraft(projectId, providerName);
      setAnalysis(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando análisis final…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">Análisis Final</h2>
            <p className="text-xs text-slate-500">
              Consolidación propuesta + R1 + R2 + R3 · sub-ítems en filas separadas · score 0–100
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {analysis && (
            <div className="text-right">
              <p className={`text-2xl font-bold tabular-nums ${scoreColor(analysis.global_score)}`}>
                {analysis.global_score != null ? `${analysis.global_score}%` : '—'}
              </p>
              <p className="text-[10px] text-slate-500">
                v{analysis.version} · {analysis.status.replace('_', ' ')}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {analysis ? 'Regenerar borrador' : 'Generar borrador'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass rounded-xl px-4 py-3 text-sm text-rose-400 border border-rose-500/20">
          {error}
        </div>
      )}

      {!analysis ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-slate-500 text-sm mb-4">
            Aún no hay análisis final para este proveedor.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Generar primer borrador
          </button>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Filas (sub-ítems)', value: stats.total },
                { label: 'Con evidencia', value: stats.withEvidence },
                { label: 'Con score', value: stats.scored },
              ].map(({ label, value }) => (
                <div key={label} className="glass rounded-xl px-4 py-3 text-center">
                  <p className="text-lg font-bold text-white tabular-nums">{value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          )}

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterCategory('')}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                  !filterCategory
                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                    : 'text-slate-500 border-transparent hover:bg-white/[0.04]'
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                    filterCategory === cat
                      ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                      : 'text-slate-500 border-transparent hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {filteredItems.length} ítems
              </p>
              <p className="text-[10px] text-slate-600">Clic para expandir evidencias</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {filteredItems.map((item) => (
                <AnalysisItemRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
