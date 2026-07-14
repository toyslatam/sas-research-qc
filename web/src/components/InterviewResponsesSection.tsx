'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, DashboardStats, InterviewResponsesMatrix, MeetingStage, Question } from '@whispper/shared';
import { getCategories, getQuestions, updateInterviewFields } from '@/lib/api';
import { downloadResponsesExcel, downloadCoverageExcel, isEmpty } from '@/lib/exportExcel';
import { groupQuestionsByCategory, type CategoryGroup } from '@/lib/questionCategories';
import { resolveInterviewAnswer, resolveAnswerByQuestionText } from '@/lib/resolveAnswer';
import { expandAnswerToSubItemRows, questionHasDisplayableAnswer } from '@/lib/subItemParse';

type Tab = 'entrevistas' | 'resumen' | 'cobertura';
type EntrevistaRow = InterviewResponsesMatrix['entrevistas'][number];
type AggregatedBlock = DashboardStats['respuestas_por_pregunta'][number];

const MEETING_STAGE_OPTIONS = [
  'Reunión #1 Exploratoria',
  'Reunión #2 Cotización',
  'Reunión #3 De clausura',
] as const satisfies readonly MeetingStage[];

function questionHasUsefulAnswer(question: Question, respuestas: Record<string, string>): boolean {
  return questionHasDisplayableAnswer(question, resolveInterviewAnswer(respuestas, question));
}

// ── Helpers de contacto estructurado ──────────────────────────────────────

interface ContactData { names: string[]; emails: string[]; phones: string[] }

function parseContact(raw?: string): ContactData {
  if (!raw) return { names: [], emails: [], phones: [] };
  try {
    const p = JSON.parse(raw) as Partial<ContactData>;
    return {
      names:  Array.isArray(p.names)  ? p.names  : [],
      emails: Array.isArray(p.emails) ? p.emails : [],
      phones: Array.isArray(p.phones) ? p.phones : [],
    };
  } catch {
    return { names: [raw], emails: [], phones: [] };
  }
}

// ── Campo multi-entrada ────────────────────────────────────────────────────

function MultiField({
  label, values, placeholder, type = 'text', onSave,
}: {
  label: string; values: string[]; placeholder: string; type?: string;
  onSave: (vals: string[]) => void;
}) {
  const [drafts, setDrafts] = useState<string[]>(values.length ? values : ['']);

  const update = (i: number, v: string) => setDrafts(d => d.map((x, j) => j === i ? v : x));
  const add    = () => setDrafts(d => [...d, '']);
  const remove = (i: number) => {
    const next = drafts.filter((_, j) => j !== i);
    const clean = next.length ? next : [''];
    setDrafts(clean);
    onSave(clean.filter(Boolean));
  };
  const save   = () => onSave(drafts.filter(Boolean));

  const inputCls = 'flex-1 px-2.5 py-1.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none transition-all duration-200';

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="space-y-1">
        {drafts.map((v, i) => (
          <div key={i} className="flex items-center gap-1">
            <input type={type} value={v} placeholder={placeholder}
              onChange={e => update(i, e.target.value)}
              onBlur={save}
              onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); if (i === drafts.length - 1) add(); }}}
              className={inputCls}
            />
            {drafts.length > 1 && (
              <button type="button" onClick={() => remove(i)}
                className="text-slate-600 hover:text-red-400 w-6 text-center shrink-0 text-xs">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={add}
          className="text-[11px] text-slate-500 hover:text-cyan-400 flex items-center gap-1 mt-0.5 transition">
          <span className="text-base leading-none">+</span> Agregar {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta por entrevista ──────────────────────────────────────────────────

function InterviewCard({
  interview, grouped, isExpanded, onToggle, onSave, cardRef, accent = 'cyan',
}: {
  interview: EntrevistaRow & { contact?: string; interview_date?: string; meeting_stage?: string | null };
  grouped: CategoryGroup[];
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (id: number, fields: { participantName?: string; contact?: string; interviewDate?: string; meetingStage?: MeetingStage | null }) => Promise<void>;
  cardRef?: (el: HTMLDivElement | null) => void;
  accent?: 'cyan' | 'amber';
}) {
  const [name,    setName]    = useState(interview.participant_name ?? '');
  const [contact, setContact] = useState(() => parseContact(interview.contact));
  const [meetingStage, setMeetingStage] = useState<MeetingStage>(
    interview.meeting_stage ?? 'Reunión #1 Exploratoria'
  );

  const allQuestions = grouped.flatMap((g) => g.questions);
  const answered = allQuestions.filter((q) => questionHasUsefulAnswer(q, interview.respuestas)).length;
  const total    = allQuestions.length;
  const accentAvatar = accent === 'amber'
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    : 'bg-cyan-600/20 border-cyan-600/40 text-cyan-400';
  const accentCategory = accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
  const accentHover = accent === 'amber' ? 'hover:text-amber-300' : 'hover:text-cyan-400';
  const accentFocus = accent === 'amber' ? 'focus:border-amber-500/50' : 'focus:border-cyan-500/50';
  const pct      = total ? Math.round((answered / total) * 100) : 0;
  const pctColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-cyan-500';
  const pctText  = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-slate-400';

  const saveContact = (updated: ContactData) => {
    setContact(updated);
    void onSave(interview.id, { contact: JSON.stringify(updated) });
  };

  const saveMeetingStage = (value: MeetingStage) => {
    setMeetingStage(value);
    void onSave(interview.id, { meetingStage: value });
  };

  return (
    <div
      ref={cardRef}
      className="glass rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up"
    >

      {/* ── TOP HEADER (nombre + progress + toggle) ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/10">
        <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold shrink-0 ${accentAvatar}`}>
          {(name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
          <input
            type="text" value={name} placeholder="Nombre o empresa entrevistada"
            onChange={e => setName(e.target.value)}
            onBlur={() => { if (name !== interview.participant_name) void onSave(interview.id, { participantName: name }); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className={`w-full px-3 py-2 text-base font-semibold rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-100 placeholder:text-slate-600 ${accentFocus} focus:bg-white/[0.05] focus:outline-none transition-all duration-200`}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={onToggle}>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pctColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-mono ${pctText}`}>{pct}%</span>
          </div>
          <span className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── CONTACT + DATE (siempre visibles) ── */}
      <div className="px-4 py-4 bg-black/20 border-t border-white/[0.05]" onClick={e => e.stopPropagation()}>
        <div className={`grid grid-cols-1 ${interview.module_type === 'exploratorio' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-4`}>
          <MultiField label="Nombre de contacto" placeholder="Nombre completo" values={contact.names}
            onSave={vals => saveContact({ ...contact, names: vals })} />
          <MultiField label="Correo" placeholder="email@empresa.com" type="email" values={contact.emails}
            onSave={vals => saveContact({ ...contact, emails: vals })} />
          <MultiField label="Teléfono" placeholder="+57 300 000 0000" type="tel" values={contact.phones}
            onSave={vals => saveContact({ ...contact, phones: vals })} />
          {interview.module_type === 'exploratorio' && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Etapa de reunión
              </p>
              <select
                value={meetingStage}
                onChange={(e) => saveMeetingStage(e.target.value as MeetingStage)}
                className="w-full px-2.5 py-1.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 focus:border-cyan-500/50 focus:outline-none transition-all duration-200"
              >
                {MEETING_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

      </div>

      {/* ── META BAR ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-t border-slate-800/40 text-xs text-slate-600">
        <span>{interview.proyecto}</span>
        <span>·</span>
        <span>{interview.fecha}</span>
        <span>·</span>
        <span className={pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-yellow-500' : 'text-slate-500'}>
          {answered}/{total} resp.
        </span>
        <div className="flex-1" />
        <button type="button" onClick={onToggle}
          className={`text-slate-500 ${accentHover} transition flex items-center gap-1`}>
          {isExpanded ? '▲ Colapsar' : '▼ Ver respuestas'}
        </button>
      </div>

      {/* ── Q&A por categoría ── */}
      {isExpanded && (
        <div className="divide-y divide-slate-800/50">
          {grouped.map(({ category, questions: qs }) => {
            const pairs = qs.map((q) => ({
              q,
              a: resolveInterviewAnswer(interview.respuestas, q) ?? '',
            }));
            if (pairs.length === 0) return null;
            const catAnswered = pairs.filter(({ q, a }) => questionHasDisplayableAnswer(q, a)).length;
            return (
              <div key={category} className="bg-slate-950/40">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/50 border-b border-slate-800/40">
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${accentCategory}`}>{category}</span>
                  <div className="flex-1 h-px bg-slate-800/50" />
                  <span className="text-[10px] text-slate-600">{catAnswered}/{pairs.length}</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {pairs.map(({ q, a }) => {
                    const num = q.sort_order ?? q.id;
                    const subRows = expandAnswerToSubItemRows(q, num, a);
                    const hasSubItems = (q.sub_items?.length ?? 0) > 0;
                    const coveredSubRows = subRows.filter((row) => row.covered);
                    const hasUsefulAnswer = questionHasDisplayableAnswer(q, a);
                    return (
                      <div key={q.id} className="grid grid-cols-[2fr_3fr] gap-4 text-sm">
                        <p className="text-slate-400 leading-relaxed">{q.text}</p>
                        <div className={`leading-relaxed ${hasUsefulAnswer ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                          {!hasUsefulAnswer ? (
                            'No mencionado'
                          ) : hasSubItems ? (
                            coveredSubRows.length > 0 ? (
                              <div className="space-y-2">
                                {coveredSubRows.map((row) => (
                                  <div key={row.code} className="text-slate-200">
                                    <span className={`font-mono text-[11px] mr-2 ${accentCategory}`}>
                                      {row.code}
                                    </span>
                                    <span className="text-slate-400">{row.subItemText}: </span>
                                    <span>{row.answer}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              a
                            )
                          ) : (
                            a
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Bloque de frecuencias por pregunta ─────────────────────────────────────

function FrequencyBlock({ block }: { block: AggregatedBlock }) {
  const max = Math.max(...block.respuestas.map((r) => r.count), 1);
  return (
    <div className="glass rounded-xl p-4 hover:border-white/[0.12] transition-all duration-200">
      <p className="text-sm text-slate-200 font-medium mb-3 leading-relaxed">{block.pregunta}</p>
      <div className="space-y-2">
        {block.respuestas.map((r) => (
          <div key={`${block.pregunta}-${r.valor}`} className="text-xs">
            <div className="flex items-center justify-between mb-0.5 gap-2">
              <span className="text-slate-300 truncate flex-1" title={r.valor}>
                {r.valor}
              </span>
              <span className="text-slate-500 shrink-0 font-mono">{r.count}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500/50 rounded-full"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vista de cobertura ─────────────────────────────────────────────────────

function CoverageView({ matrix }: { matrix: InterviewResponsesMatrix }) {
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [openE, setOpenE] = useState<number | null>(null);
  const total = matrix.entrevistas.length;
  const totalQ = matrix.preguntas.length;

  const byQuestion = matrix.preguntas
    .map((p) => {
      const answered = matrix.entrevistas.filter((e) => !isEmpty(resolveAnswerByQuestionText(e.respuestas, p)));
      const missing = matrix.entrevistas.filter((e) => isEmpty(resolveAnswerByQuestionText(e.respuestas, p)));
      const pct = total ? Math.round((answered.length / total) * 100) : 0;
      return { p, answered: answered.length, missing, pct };
    })
    .sort((a, b) => a.pct - b.pct);

  const byInterview = matrix.entrevistas
    .map((e) => {
      const answered = matrix.preguntas.filter((p) => !isEmpty(resolveAnswerByQuestionText(e.respuestas, p)));
      const missing = matrix.preguntas.filter((p) => isEmpty(resolveAnswerByQuestionText(e.respuestas, p)));
      const pct = totalQ ? Math.round((answered.length / totalQ) * 100) : 0;
      return { e, answered: answered.length, missing, pct };
    })
    .sort((a, b) => a.pct - b.pct);

  function CoverageBar({ pct }: { pct: number }) {
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-mono shrink-0 w-9 text-right ${
          pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
        }`}>{pct}%</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Preguntas con más faltantes */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-sm font-semibold text-slate-300">Cobertura por pregunta</p>
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-600">{byQuestion.length}</span>
        </div>
        <div className="space-y-1.5">
          {byQuestion.map(({ p, answered, missing, pct }) => (
            <div key={p} className="bg-slate-950/50 border border-slate-800/60 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenQ(openQ === p ? null : p)}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-800/40 transition"
              >
                <p className="text-xs text-slate-300 line-clamp-2 mb-1.5">{p}</p>
                <div className="flex items-center gap-3">
                  <CoverageBar pct={pct} />
                  <span className="text-xs text-slate-500 shrink-0">{answered}/{total}</span>
                  {missing.length > 0 && (
                    <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded shrink-0">
                      {missing.length} falta{missing.length > 1 ? 'n' : ''}
                    </span>
                  )}
                </div>
              </button>
              {openQ === p && missing.length > 0 && (
                <div className="px-3 pb-2.5 border-t border-slate-800/50 pt-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">No respondieron:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((e) => (
                      <span key={e.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                        {e.participant_name || `#${e.id}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Entrevistas con más faltantes */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-sm font-semibold text-slate-300">Cobertura por entrevista</p>
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-600">{byInterview.length}</span>
        </div>
        <div className="space-y-1.5">
          {byInterview.map(({ e, answered, missing, pct }) => (
            <div key={e.id} className="bg-slate-950/50 border border-slate-800/60 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenE(openE === e.id ? null : e.id)}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {e.participant_name || `Entrevistado #${e.id}`}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">{e.fecha}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CoverageBar pct={pct} />
                  <span className="text-xs text-slate-500 shrink-0">{answered}/{totalQ}</span>
                  {missing.length > 0 && (
                    <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded shrink-0">
                      {missing.length} falta{missing.length > 1 ? 'n' : ''}
                    </span>
                  )}
                </div>
              </button>
              {openE === e.id && missing.length > 0 && (
                <div className="px-3 pb-2.5 border-t border-slate-800/50 pt-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Preguntas sin respuesta:</p>
                  <ul className="space-y-1">
                    {missing.map((q) => (
                      <li key={q} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-red-500 shrink-0">✗</span>
                        <span className="line-clamp-2">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function InterviewResponsesSection({
  matrix: initialMatrix,
  aggregated,
  projectId,
  questions: questionsProp,
  focusInterviewId,
  sectionId = 'respuestas-cuestionario',
  accent = 'cyan',
}: {
  matrix: InterviewResponsesMatrix;
  aggregated: DashboardStats['respuestas_por_pregunta'];
  projectId?: number;
  questions?: Question[];
  focusInterviewId?: number | null;
  sectionId?: string;
  accent?: 'cyan' | 'amber';
}) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [tab, setTab] = useState<Tab>('entrevistas');
  const [questions, setQuestions] = useState<Question[]>(questionsProp ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => { setMatrix(initialMatrix); }, [initialMatrix]);

  useEffect(() => {
    if (questionsProp?.length) {
      setQuestions(questionsProp);
    } else if (projectId) {
      getQuestions(projectId).then(setQuestions).catch(() => setQuestions([]));
    } else {
      setQuestions([]);
    }
  }, [projectId, questionsProp]);

  useEffect(() => {
    if (!projectId) {
      setCategories([]);
      return;
    }
    getCategories(projectId).then(setCategories).catch(() => setCategories([]));
  }, [projectId]);

  useEffect(() => {
    if (focusInterviewId == null) return;
    setTab('entrevistas');
    setExpandedIds((prev) => new Set([...prev, focusInterviewId]));
    const timer = window.setTimeout(() => {
      cardRefs.current.get(focusInterviewId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusInterviewId]);

  const questionsSource = questions.length
    ? questions
    : matrix.preguntas.map((text, i) => ({
        id: i,
        project_id: projectId ?? 0,
        text,
        category: 'General',
        category_id: null,
        sub_items: [],
        sort_order: i,
      }));

  const grouped = useMemo(
    () => groupQuestionsByCategory(questionsSource, categories),
    [questionsSource, categories]
  );
  const hasData = matrix.entrevistas.length > 0;
  const allIds = matrix.entrevistas.map((e) => e.id);
  const allExpanded = allIds.every((id) => expandedIds.has(id));

  const toggleCard = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setExpandedIds(allExpanded ? new Set() : new Set(allIds));

  const saveParticipant = async (
    id: number,
    fields: { participantName?: string; contact?: string; interviewDate?: string; meetingStage?: MeetingStage | null }
  ) => {
    await updateInterviewFields(id, fields);
    setMatrix((prev) => ({
      ...prev,
      entrevistas: prev.entrevistas.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(fields.participantName !== undefined && { participant_name: fields.participantName }),
              ...(fields.contact !== undefined && { contact: fields.contact }),
              ...(fields.interviewDate !== undefined && { interview_date: fields.interviewDate }),
              ...(fields.meetingStage !== undefined && { meeting_stage: fields.meetingStage }),
            }
          : e
      ),
    }));
  };

  const accentTab = accent === 'amber'
    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25';

  return (
    <section id={sectionId} className="glass rounded-2xl p-6 scroll-mt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Respuestas del cuestionario</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="text-cyan-400 font-medium">{matrix.entrevistas.length}</span> entrevista{matrix.entrevistas.length !== 1 ? 's' : ''}
            {' · '}
            <span className="text-slate-400">{matrix.preguntas.length} preguntas</span>
            {grouped.length > 1 && <span className="text-slate-500"> · {grouped.length} categorías</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/[0.08] p-1 bg-black/20 gap-0.5">
            {([['entrevistas','Por entrevista'],['resumen','Frecuencias'],['cobertura','Cobertura']] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 font-medium ${
                  tab === t
                    ? t === 'cobertura'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : accentTab
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >{label}</button>
            ))}
          </div>
          {tab !== 'cobertura' ? (
            <button type="button" disabled={!hasData} onClick={() => downloadResponsesExcel(matrix, questions)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200">
              ↓ Excel
            </button>
          ) : (
            <button type="button" disabled={!hasData} onClick={() => downloadCoverageExcel(matrix, questions)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200">
              ↓ Reporte faltantes
            </button>
          )}
        </div>
      </div>

      {!hasData && (
        <p className="text-slate-500 text-sm">
          Procese entrevistas desde la app de escritorio para ver datos aquí.
        </p>
      )}

      {/* Vista por entrevista */}
      {hasData && tab === 'entrevistas' && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-slate-400 hover:text-cyan-400 transition"
            >
              {allExpanded ? '▲ Colapsar todas' : '▼ Expandir todas'}
            </button>
          </div>
          <div className="space-y-2">
            {matrix.entrevistas.map((e) => (
              <InterviewCard
                key={e.id}
                interview={e}
                grouped={grouped}
                isExpanded={expandedIds.has(e.id)}
                onToggle={() => toggleCard(e.id)}
                onSave={saveParticipant}
                accent={accent}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(e.id, el);
                  else cardRefs.current.delete(e.id);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vista de cobertura */}
      {hasData && tab === 'cobertura' && <CoverageView matrix={matrix} />}

      {/* Vista de frecuencias agrupadas por categoría */}
      {hasData && tab === 'resumen' && (
        <div className="space-y-8">
          {aggregated.length === 0 && (
            <p className="text-slate-500 text-sm">Sin datos para los filtros actuales.</p>
          )}

          {grouped.length > 1
            ? grouped.map(({ category, questions: qs }) => {
                const texts = qs.map((q) => q.text);
                const blocks = aggregated.filter((b) => texts.includes(b.pregunta));
                if (blocks.length === 0) return null;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest whitespace-nowrap">
                        {category}
                      </span>
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-xs text-slate-600">{blocks.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {blocks.map((b) => (
                        <FrequencyBlock key={b.pregunta} block={b} />
                      ))}
                    </div>
                  </div>
                );
              })
            : /* Sin categorías cargadas → lista simple en grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aggregated.map((b) => (
                  <FrequencyBlock key={b.pregunta} block={b} />
                ))}
              </div>}
        </div>
      )}
    </section>
  );
}
