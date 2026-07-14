'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mic, BarChart3, ChevronRight, Search } from 'lucide-react';
import type { DashboardStats, InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getDashboardStats, getInterviewResponsesMatrix, getProjects, getQuestions, getWordCloud } from '@/lib/api';
import { isEmptyAnswer } from '@/lib/answers';
import { InterviewResponsesSection } from '@/components/InterviewResponsesSection';
import { DashboardFilters } from '@/components/DashboardFilters';
import { StatCard } from '@/components/StatCard';
import { WordCloud } from '@/components/WordCloud';
import { usePersistedProjectFilters } from '@/hooks/usePersistedProjectFilters';

// ── Badge de tipo de fuente ────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pdf:   { label: 'PDF',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/25' },
    docx:  { label: 'Word',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    xlsx:  { label: 'Excel', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    audio: { label: 'Audio', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  };
  const s = map[source] ?? { label: source, cls: 'bg-slate-700 text-slate-300 border-slate-600' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function providerLabel(interview: InterviewResponsesMatrix['entrevistas'][number]) {
  return interview.participant_name?.trim() || `Entrevista #${interview.id}`;
}

// ── Card de entrevista (navega a respuestas) ────────────────────────────────

function InterviewSelectCard({
  interview,
  questions,
  onSelect,
}: {
  interview: InterviewResponsesMatrix['entrevistas'][number];
  questions: Question[];
  onSelect: (interview: InterviewResponsesMatrix['entrevistas'][number]) => void;
}) {
  const total = questions.length || Object.keys(interview.respuestas).length;
  const answered = questions.length
    ? questions.filter(q => !isEmptyAnswer(interview.respuestas[q.text])).length
    : Object.values(interview.respuestas).filter(v => !isEmptyAnswer(v)).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(interview)}
      className="w-full glass rounded-2xl overflow-hidden shadow-card text-left hover:border-cyan-500/25 hover:bg-white/[0.02] transition-all group"
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 font-bold shrink-0">
          {providerLabel(interview)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate group-hover:text-cyan-200 transition-colors">
              {providerLabel(interview)}
            </p>
            <SourceBadge source={interview.source_type} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{interview.proyecto} · {interview.fecha}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-mono ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-cyan-400'}`}>
              {pct}%
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

export default function ExploratoryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { filters, setFilters } = usePersistedProjectFilters({ moduleType: 'exploratorio' });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [matrix, setMatrix] = useState<InterviewResponsesMatrix | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusInterviewId, setFocusInterviewId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s, m, w] = await Promise.all([
        getProjects(),
        getDashboardStats({ ...filters, moduleType: 'exploratorio' }),
        getInterviewResponsesMatrix({ ...filters, moduleType: 'exploratorio' }),
        getWordCloud({ projectId: filters.projectId, moduleType: 'exploratorio' }),
      ]);
      setProjects(p);
      setStats(s);
      setMatrix(m);
      setWords(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const effectiveProjectId = filters.projectId
    ?? (projects.length === 1 ? projects[0].id : undefined)
    ?? (matrix?.entrevistas.length ? projects.find(p => p.name === matrix.entrevistas[0].proyecto)?.id : undefined);

  useEffect(() => {
    if (!effectiveProjectId) {
      setQuestions([]);
      return;
    }
    getQuestions(effectiveProjectId).then(setQuestions).catch(() => setQuestions([]));
  }, [effectiveProjectId]);

  const searchNorm = searchQuery.trim().toLowerCase();

  const filteredInterviews = useMemo(() => {
    if (!matrix) return [];
    return matrix.entrevistas.filter((e) => {
      const name = providerLabel(e).toLowerCase();
      return !searchNorm || name.includes(searchNorm);
    });
  }, [matrix, searchNorm]);

  const filteredMatrix = useMemo<InterviewResponsesMatrix | null>(() => {
    if (!matrix) return null;
    return { ...matrix, entrevistas: filteredInterviews };
  }, [matrix, filteredInterviews]);

  const searchSuggestions = useMemo(() => {
    if (!matrix || !searchNorm) return [];
    return matrix.entrevistas
      .map(providerLabel)
      .filter((name, idx, arr) => name.toLowerCase().includes(searchNorm) && arr.indexOf(name) === idx)
      .slice(0, 6);
  }, [matrix, searchNorm]);

  const handleSelectProvider = (interview: InterviewResponsesMatrix['entrevistas'][number]) => {
    setSearchQuery(providerLabel(interview));
    setFocusInterviewId(interview.id);
    window.setTimeout(() => {
      document.getElementById('respuestas-cuestionario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-sky-500/50 to-transparent" />
            <span className="text-xs font-medium text-sky-400 uppercase tracking-widest">Módulo Exploratorio</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
            Entrevistas
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Grabaciones de audio procesadas con Whisper + GPT</p>
        </div>
      </header>

      <DashboardFilters projects={projects} filters={filters}
        onChange={f => setFilters({ ...f, moduleType: 'exploratorio' })} />

      {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">⚠ {error}</div>}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          Cargando entrevistas...
        </div>
      )}

      {stats && !loading && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Entrevistas" value={stats.total_entrevistas} icon={Mic} accent="cyan"
              subtitle="Procesadas con Whisper" />
            <StatCard title="Preguntas con datos" value={questions.length || (matrix?.preguntas.length ?? 0)} icon={BarChart3} accent="violet" />
            <StatCard title="Participantes" value={matrix ? new Set(matrix.entrevistas.map(e => e.participant_name)).size : 0}
              icon={BarChart3} accent="emerald" />
          </div>

          {words.length > 0 && (
            <section className="glass rounded-2xl p-6">
              <p className="text-sm font-semibold text-white mb-4">Palabras clave en entrevistas</p>
              <WordCloud words={words} />
            </section>
          )}

          {matrix && matrix.entrevistas.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-slate-400 font-medium">
                  {filteredInterviews.length} de {matrix.entrevistas.length} entrevista{matrix.entrevistas.length > 1 ? 's' : ''} —
                  haz clic en un proveedor para ver sus respuestas
                </p>
                <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[320px]">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setFocusInterviewId(null);
                      }}
                      placeholder="Buscar proveedor..."
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-white/[0.08] bg-slate-950/70 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                    />
                    {searchSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-white/[0.08] bg-slate-950/95 shadow-xl overflow-hidden">
                        {searchSuggestions.map((name) => {
                          const interview = matrix.entrevistas.find(e => providerLabel(e) === name);
                          if (!interview) return null;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => handleSelectProvider(interview)}
                              className="w-full px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFocusInterviewId(null);
                      }}
                      className="px-3 py-2 text-xs rounded-xl border border-white/[0.08] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition whitespace-nowrap"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {filteredInterviews.length > 0 ? (
                filteredInterviews.map(e => (
                  <InterviewSelectCard
                    key={e.id}
                    interview={e}
                    questions={questions}
                    onSelect={handleSelectProvider}
                  />
                ))
              ) : (
                <div className="glass rounded-2xl p-8 text-center">
                  <p className="text-slate-400">No hay proveedores que coincidan con &quot;{searchQuery}&quot;</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Ver todos los proveedores
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <Mic className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">No hay entrevistas cargadas aún</p>
              <p className="text-slate-600 text-sm mt-1">
                {effectiveProjectId
                  ? 'Graba o importa audios desde la app de escritorio.'
                  : 'Selecciona un proyecto para ver sus entrevistas.'}
              </p>
            </div>
          )}

          {filteredMatrix && filteredMatrix.entrevistas.length > 0 && (
            <InterviewResponsesSection
              matrix={filteredMatrix}
              aggregated={stats.respuestas_por_pregunta}
              projectId={effectiveProjectId}
              questions={questions}
              focusInterviewId={focusInterviewId}
              accent="cyan"
            />
          )}
        </div>
      )}
    </main>
  );
}
