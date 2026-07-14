'use client';

import { useEffect, useState } from 'react';
import {
  FileText, Mic, ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';
import {
  STAGE_SHORT,
  type IncrementalCoverage,
  type ProviderAnalysis,
  type QuestionAnalysis,
} from '@/lib/providerAnalysis';

// ── Stage visual config ────────────────────────────────────────────────────

interface StageCfg {
  short: string;
  bg: string;
  border: string;
  label: string;
  bar: string;
}

const STAGE_CFG: Record<string, StageCfg> = {
  'Reunión #1 Exploratoria': { short: 'R1 · Exploratoria', bg: 'bg-cyan-500/5',    border: 'border-cyan-500/15',    label: 'text-cyan-400',    bar: 'bg-cyan-500'    },
  'Reunión #2 Cotización':   { short: 'R2 · Cotización',   bg: 'bg-violet-500/5',  border: 'border-violet-500/15',  label: 'text-violet-400',  bar: 'bg-violet-500'  },
  'Reunión #3 De clausura':  { short: 'R3 · Clausura',     bg: 'bg-fuchsia-500/5', border: 'border-fuchsia-500/15', label: 'text-fuchsia-400', bar: 'bg-fuchsia-500' },
};

function stageCfgByShort(shortLabel: string): StageCfg | null {
  return Object.values(STAGE_CFG).find((c) => c.short === shortLabel) ?? null;
}
function stageCfgByFull(fullLabel: string): StageCfg | null {
  return STAGE_CFG[fullLabel] ?? null;
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = {
    pdf:  'bg-rose-500/15 text-rose-400 border-rose-500/20',
    docx: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    xlsx: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    audio:'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${map[source] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
      {source}
    </span>
  );
}

function StatusPill({ status }: { status: QuestionAnalysis['status'] }) {
  const map: Record<QuestionAnalysis['status'], { label: string; cls: string }> = {
    missing_both:    { label: 'Sin cobertura',   cls: 'bg-slate-700/50 text-slate-400' },
    propuesta_only:  { label: 'Solo propuesta',  cls: 'bg-amber-500/15 text-amber-400' },
    entrevista_only: { label: 'Solo entrevista', cls: 'bg-cyan-500/15 text-cyan-400'   },
    both_aligned:    { label: 'Coincide',        cls: 'bg-emerald-500/15 text-emerald-400' },
    both_differ:     { label: 'Difiere',         cls: 'bg-rose-500/15 text-rose-400'   },
  };
  const s = map[status];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>;
}

function IncrementalFunnel({
  coverage,
  totalQuestions,
}: {
  coverage: IncrementalCoverage[];
  totalQuestions: number;
}) {
  const lastAccumulated = coverage[coverage.length - 1]?.accumulated ?? 0;
  const uncovered = totalQuestions - lastAccumulated;

  return (
    <div>
      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-3">
        Cobertura acumulada incremental
      </p>
      <div className="space-y-2">
        {coverage.map((c) => {
          const cfg = c.sourceLabel === 'Propuesta'
            ? null
            : stageCfgByShort(c.sourceLabel);
          const barColor = cfg?.bar ?? 'bg-amber-500';
          const labelColor = cfg?.label ?? 'text-amber-400';

          return (
            <div key={c.sourceLabel} className="flex items-center gap-3 text-xs">
              <div className="w-36 shrink-0">
                <p className={`font-medium truncate ${labelColor}`}>{c.sourceLabel}</p>
              </div>
              <div className="w-12 text-right shrink-0 text-slate-500 tabular-nums">
                {c.answered}/{totalQuestions}
              </div>
              <div className="w-10 text-center shrink-0">
                {c.newAnswers > 0
                  ? <span className="text-[10px] font-bold text-emerald-400">+{c.newAnswers}</span>
                  : <span className="text-[10px] text-slate-700">+0</span>
                }
              </div>
              <div className="flex-1 relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${c.accumulatedPct}%` }}
                />
              </div>
              <div className="w-24 text-right shrink-0 tabular-nums">
                <span className="text-slate-300 font-medium">{c.accumulated}/{totalQuestions}</span>
                <span className="text-slate-600 ml-1">({c.accumulatedPct}%)</span>
              </div>
            </div>
          );
        })}
        {uncovered > 0 && (
          <div className="flex items-center gap-3 text-xs pt-2 border-t border-white/[0.05] mt-1">
            <div className="w-36 shrink-0 text-slate-500 font-medium">Sin cubrir</div>
            <div className="flex-1" />
            <span className="text-rose-400 font-semibold">{uncovered} preguntas pendientes</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareQuestionRow({
  item,
  hasProposal,
  stageLabels,
  defaultOpen = false,
}: {
  item: QuestionAnalysis;
  hasProposal: boolean;
  stageLabels: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasAny = item.answerSources.length > 0;
  const sourceMap = new Map(item.answerSources.map((s) => [s.label, s]));

  const rows: Array<{
    label: string;
    isProposal: boolean;
    cfg: StageCfg | null;
    src: (typeof item.answerSources)[number] | undefined;
  }> = [
    ...(hasProposal
      ? [{ label: 'Propuesta', isProposal: true, cfg: null, src: sourceMap.get('Propuesta') }]
      : []),
    ...stageLabels.map((stage) => {
      const short = STAGE_SHORT[stage] ?? stage;
      return {
        label: short,
        isProposal: false,
        cfg: stageCfgByFull(stage),
        src: sourceMap.get(short),
      };
    }),
  ];

  return (
    <div
      className={`rounded-xl overflow-hidden border ${
        hasAny
          ? 'border-white/[0.07] bg-white/[0.01]'
          : 'border-white/[0.04] bg-white/[0.005] opacity-60'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-all"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 leading-snug">{item.question.text}</p>
        </div>
        <StatusPill status={item.status} />
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rows.map(({ label, isProposal, cfg, src }) => {
            const bgCls     = isProposal ? 'bg-amber-500/5'  : (cfg?.bg     ?? 'bg-white/[0.02]');
            const borderCls = isProposal ? 'border-amber-500/15' : (cfg?.border ?? 'border-white/[0.05]');
            const labelCls  = isProposal ? 'text-amber-400'  : (cfg?.label  ?? 'text-slate-400');

            return (
              <div key={label} className={`rounded-xl border ${bgCls} ${borderCls} px-4 py-3`}>
                <div className="flex items-center gap-2 mb-2">
                  {isProposal
                    ? <FileText className="w-3 h-3 shrink-0" style={{ color: 'inherit' }} />
                    : <Mic className="w-3 h-3 shrink-0" />
                  }
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>
                    {label}
                  </p>
                  {src && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        src.isNew
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-yellow-500/15 text-yellow-400'
                      }`}
                    >
                      {src.isNew ? '● Nueva' : '◑ Complementa'}
                    </span>
                  )}
                </div>
                {src
                  ? <p className="text-xs text-slate-300 leading-relaxed">{src.answer}</p>
                  : <p className="text-xs text-slate-600 italic">Sin respuesta</p>
                }
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProviderAnalysisBody({ analysis }: { analysis: ProviderAnalysis }) {
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>({});
  const { provider, stageLabels } = analysis;
  const hasProposal = provider.proposals.length > 0;
  const toggleCat = (cat: string) =>
    setCatOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-4">
        <IncrementalFunnel
          coverage={analysis.incrementalCoverage}
          totalQuestions={analysis.totalQuestions}
        />
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[0.06] text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-400">
            {analysis.missingBoth.length} sin cobertura
          </span>
          <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400">
            {analysis.propuestaOnly.length} solo propuesta
          </span>
          <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400">
            {analysis.entrevistaOnly.length} solo entrevista
          </span>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
            {analysis.bothAnswered.length - analysis.conflicts.length} coinciden
          </span>
          {analysis.conflicts.length > 0 && (
            <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400">
              {analysis.conflicts.length} difieren
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/15 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-fuchsia-400" />
          <p className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider">
            Sugerencias para próxima reunión
          </p>
        </div>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">{analysis.summary}</p>
        <ul className="space-y-1.5">
          {analysis.followUpSuggestions.map((s, i) => (
            <li
              key={i}
              className={`text-sm leading-relaxed ${s.startsWith('•') ? 'text-slate-400 pl-1' : 'text-slate-200'}`}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Detalle por pregunta — fuentes apiladas
        </p>
        {Array.from(analysis.byCategory.entries()).map(([cat, items]) => {
          const isOpen = catOpen[cat] ?? true;
          const catCovered = items.filter((i) => i.answerSources.length > 0).length;
          return (
            <div key={cat} className="mb-4">
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-3 py-2 mb-2 text-left"
              >
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{cat}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] text-slate-600">{catCovered}/{items.length}</span>
                {isOpen
                  ? <ChevronUp className="w-3 h-3 text-slate-600" />
                  : <ChevronDown className="w-3 h-3 text-slate-600" />
                }
              </button>
              {isOpen && (
                <div className="space-y-2">
                  {items.map((item) => (
                    <CompareQuestionRow
                      key={item.question.id}
                      item={item}
                      hasProposal={hasProposal}
                      stageLabels={stageLabels}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Collapsible card — used in comparative analysis list. */
export function ProviderAnalysisCard({
  analysis,
  forceExpanded = false,
}: {
  analysis: ProviderAnalysis;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(forceExpanded);
  useEffect(() => { setExpanded(forceExpanded); }, [forceExpanded]);

  const { provider, combinedPct, stageLabels } = analysis;
  const pctColor = combinedPct >= 80 ? 'text-emerald-400' : combinedPct >= 50 ? 'text-yellow-400' : 'text-rose-400';
  const pctBg    = combinedPct >= 80 ? 'bg-emerald-500'   : combinedPct >= 50 ? 'bg-yellow-500'   : 'bg-rose-500';
  const hasProposal = provider.proposals.length > 0;

  return (
    <div className="glass rounded-2xl overflow-hidden shadow-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/[0.08] flex items-center justify-center text-white font-bold shrink-0">
          {provider.name[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{provider.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {hasProposal && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <FileText className="w-3 h-3" />
                {provider.proposals.length} propuesta{provider.proposals.length > 1 ? 's' : ''}
                {provider.proposals.map((p) => <SourceBadge key={p.id} source={p.source_type} />)}
              </span>
            )}
            {stageLabels.map((stage) => {
              const cfg = stageCfgByFull(stage);
              const count = provider.interviews.filter(
                (e) => (e.meeting_stage ?? 'Reunión #1 Exploratoria') === stage,
              ).length;
              return (
                <span key={stage} className={`flex items-center gap-1 text-xs ${cfg?.label ?? 'text-cyan-400'}`}>
                  <Mic className="w-3 h-3" />
                  {cfg?.short ?? stage}
                  {count > 1 && <span className="opacity-60">×{count}</span>}
                </span>
              );
            })}
            {stageLabels.length === 0 && provider.interviews.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-cyan-400">
                <Mic className="w-3 h-3" />
                {provider.interviews.length} entrevista{provider.interviews.length > 1 ? 's' : ''}
              </span>
            )}
            {!hasProposal && (
              <span className="text-[10px] text-rose-400/80">Sin propuesta</span>
            )}
            {provider.interviews.length === 0 && (
              <span className="text-[10px] text-rose-400/80">Sin entrevista</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <p className={`text-lg font-bold ${pctColor}`}>{combinedPct}%</p>
            <p className="text-[10px] text-slate-600">combinada</p>
          </div>
          <div className="w-1.5 h-12 bg-white/[0.04] rounded-full overflow-hidden">
            <div className={`${pctBg} rounded-full`} style={{ height: `${combinedPct}%`, marginTop: `${100 - combinedPct}%` }} />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/[0.05] p-5">
          <ProviderAnalysisBody analysis={analysis} />
        </div>
      )}
    </div>
  );
}

/** Always-expanded body — used in provider detail page. */
export function ProviderConsolidatedPanel({ analysis }: { analysis: ProviderAnalysis }) {
  return <ProviderAnalysisBody analysis={analysis} />;
}
