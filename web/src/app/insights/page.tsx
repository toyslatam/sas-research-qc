'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, AlertTriangle, Trophy, TrendingUp, Search } from 'lucide-react';
import type { InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getDashboardStats, getInterviewResponsesMatrix, getProjects, getQuestions, getWordCloud } from '@/lib/api';
import { isEmptyAnswer } from '@/lib/answers';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

// ── helpers ────────────────────────────────────────────────────────────────

const isEmpty = isEmptyAnswer;

type EntrevistaRow = InterviewResponsesMatrix['entrevistas'][number];

// ── Coverage per participant ───────────────────────────────────────────────

function participantCoverage(entries: EntrevistaRow[], questions: Question[]) {
  const map = new Map<string, { name: string; answered: number }>();
  for (const e of entries) {
    const key = e.participant_name || `#${e.id}`;
    if (!map.has(key)) map.set(key, { name: key, answered: 0 });
    const row = map.get(key)!;
    for (const q of questions) {
      if (!isEmpty(e.respuestas[q.text])) row.answered++;
    }
  }
  return Array.from(map.values())
    .map(r => ({ ...r, pct: questions.length ? Math.round((r.answered / questions.length) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);
}

// ── Gap detection ──────────────────────────────────────────────────────────

function detectGaps(entries: EntrevistaRow[], questions: Question[]) {
  return questions
    .map(q => ({
      question: q.text,
      category: q.category,
      answeredBy: entries.filter(e => !isEmpty(e.respuestas[q.text])).length,
      total: entries.length,
    }))
    .filter(g => g.answeredBy === 0)
    .slice(0, 10);
}

// ── Hallazgos from aggregated stats ───────────────────────────────────────

function autoHallazgos(
  proposals: InterviewResponsesMatrix,
  interviews: InterviewResponsesMatrix,
  questions: Question[]
) {
  const findings: string[] = [];
  const totalActors = new Set([
    ...proposals.entrevistas.map(e => e.participant_name),
    ...interviews.entrevistas.map(e => e.participant_name),
  ]).size;

  if (totalActors === 0) return findings;

  for (const q of questions.slice(0, 15)) {
    const propAnswers  = proposals.entrevistas.filter(e  => !isEmpty(e.respuestas[q.text]));
    const interAnswers = interviews.entrevistas.filter(e => !isEmpty(e.respuestas[q.text]));
    const total = propAnswers.length + interAnswers.length;
    if (total > 0 && total >= totalActors * 0.6) {
      // Buscar respuestas comunes
      const vals = [...propAnswers, ...interAnswers].map(e => e.respuestas[q.text]).filter(Boolean);
      if (vals.length > 0) {
        const short = q.text.replace(/^¿|[?]$/g, '').slice(0, 60);
        findings.push(`${total}/${totalActors} participante${total > 1 ? 's' : ''} respondieron: "${short}"`);
      }
    }
  }
  return findings.slice(0, 6);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { projectId, setProjectId, hydrated } = useProjectContext();
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [proposals,   setProposals]   = useState<InterviewResponsesMatrix | null>(null);
  const [interviews,  setInterviews]  = useState<InterviewResponsesMatrix | null>(null);
  const [words,       setWords]       = useState<{ text: string; value: number }[]>([]);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated || projects.length === 0 || projectId) return;
    const id = pickDefaultProjectId(projects);
    if (id) setProjectId(id);
  }, [hydrated, projects, projectId, setProjectId]);

  const load = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      const [q, prop, inter, w] = await Promise.all([
        getQuestions(pid),
        getInterviewResponsesMatrix({ projectId: pid, moduleType: 'propuesta' }),
        getInterviewResponsesMatrix({ projectId: pid, moduleType: 'exploratorio' }),
        getWordCloud({ projectId: pid }),
      ]);
      setQuestions(q);
      setProposals(prop);
      setInterviews(inter);
      setWords(w);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (projectId) void load(projectId); }, [projectId, load]);

  const allEntries = [...(proposals?.entrevistas ?? []), ...(interviews?.entrevistas ?? [])];
  const ranking    = participantCoverage(allEntries, questions);
  const gaps       = detectGaps(allEntries, questions);
  const hallazgos  = proposals && interviews ? autoHallazgos(proposals, interviews, questions) : [];

  // Contradicciones: participantes con propuesta + entrevista con respuestas distintas
  const contradictions: { actor: string; question: string }[] = [];
  if (proposals && interviews) {
    const interMap = new Map(interviews.entrevistas.map(e => [e.participant_name, e]));
    for (const p of proposals.entrevistas) {
      const inter = interMap.get(p.participant_name);
      if (!inter) continue;
      for (const q of questions.slice(0, 15)) {
        const pAns = p.respuestas[q.text];
        const iAns = inter.respuestas[q.text];
        if (!isEmpty(pAns) && !isEmpty(iAns) && pAns !== iAns) {
          contradictions.push({ actor: p.participant_name, question: q.text.slice(0, 70) });
        }
      }
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-amber-500/50 to-transparent" />
            <span className="text-xs font-medium text-amber-400 uppercase tracking-widest">Módulo Insights</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
            Insights
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Hallazgos automáticos, brechas y ranking de proveedores
          </p>
        </div>
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && (
        <div className="glass rounded-2xl p-16 text-center">
          <Lightbulb className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-lg">Selecciona un proyecto para ver insights</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 py-12">
          <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          Generando insights...
        </div>
      )}

      {!loading && projectId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">

          {/* Hallazgos principales */}
          <section className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-white">Hallazgos principales</h2>
              <span className="text-xs text-slate-600 ml-auto">generados automáticamente</span>
            </div>
            {hallazgos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hallazgos.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">{h}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Agrega más evidencias para generar hallazgos automáticos.</p>
            )}
          </section>

          {/* Ranking de proveedores */}
          <section className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-semibold text-white">Ranking de cobertura</h2>
            </div>
            {ranking.length > 0 ? (
              <div className="space-y-3">
                {ranking.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 text-right ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-700' : 'text-slate-600'}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300 truncate">{r.name}</span>
                        <span className={`text-sm font-bold ml-2 ${r.pct >= 80 ? 'text-emerald-400' : r.pct >= 50 ? 'text-yellow-400' : 'text-rose-400'}`}>
                          {r.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.pct >= 80 ? 'bg-emerald-500' : r.pct >= 50 ? 'bg-yellow-500' : 'bg-rose-500'}`}
                          style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Sin participantes con datos aún.</p>
            )}
          </section>

          {/* Preguntas sin respuesta (brechas) */}
          <section className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-rose-400" />
              <h2 className="text-base font-semibold text-white">Brechas de información</h2>
              {gaps.length > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  {gaps.length} preguntas sin respuesta
                </span>
              )}
            </div>
            {gaps.length > 0 ? (
              <div className="space-y-2">
                {gaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-rose-400/70 font-semibold uppercase tracking-wide">{g.category}</p>
                      <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{g.question}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">¡Todas las preguntas tienen al menos una respuesta!</p>
            )}
          </section>

          {/* Contradicciones */}
          {contradictions.length > 0 && (
            <section className="glass rounded-2xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h2 className="text-base font-semibold text-white">Posibles contradicciones</h2>
                <p className="text-xs text-slate-600 ml-2">Propuesta vs Entrevista del mismo actor</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contradictions.slice(0, 6).map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                    <p className="text-xs font-semibold text-yellow-400 mb-1">{c.actor}</p>
                    <p className="text-xs text-slate-400">{c.question}…</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Word cloud */}
          {words.length > 0 && (
            <section className="glass rounded-2xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">Términos más frecuentes</h2>
              </div>
              <div className="flex flex-wrap gap-2 items-center justify-center min-h-[100px] p-2">
                {words.slice(0, 30).map((w, i) => {
                  const max = words[0]?.value ?? 1;
                  const scale = 0.7 + (w.value / max) * 1.2;
                  const colors = ['text-cyan-400','text-violet-400','text-amber-400','text-emerald-400','text-rose-400'];
                  return (
                    <span key={w.text} title={`${w.value} menciones`}
                      style={{ fontSize: `${scale}rem`, opacity: 0.4 + (w.value / max) * 0.6 }}
                      className={`${colors[i % colors.length]} font-medium cursor-default select-none`}>
                      {w.text}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
