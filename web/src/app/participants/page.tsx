'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Mic, ChevronDown, ChevronUp, Users, Search } from 'lucide-react';
import type { InterviewResponsesMatrix, Project, Question } from '@whispper/shared';
import { getDashboardStats, getInterviewResponsesMatrix, getProjects, getQuestions } from '@/lib/api';
import { isEmptyAnswer } from '@/lib/answers';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

// ── helpers ────────────────────────────────────────────────────────────────

const isEmpty = isEmptyAnswer;

type EntrevistaRow = InterviewResponsesMatrix['entrevistas'][number];

// ── Participant — agregado de sus evidencias ────────────────────────────────

interface Participant {
  name: string;
  proposals:  EntrevistaRow[];
  interviews: EntrevistaRow[];
}

function buildParticipants(matrix: InterviewResponsesMatrix): Participant[] {
  const map = new Map<string, Participant>();
  for (const e of matrix.entrevistas) {
    const key = e.participant_name.trim() || `#${e.id}`;
    if (!map.has(key)) map.set(key, { name: key, proposals: [], interviews: [] });
    if (e.module_type === 'propuesta') map.get(key)!.proposals.push(e);
    else map.get(key)!.interviews.push(e);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function coverage(participant: Participant, questions: Question[]): number {
  if (!questions.length) return 0;
  const allAnswers = [...participant.proposals, ...participant.interviews];
  const answered = questions.filter(q =>
    allAnswers.some(e => !isEmpty(e.respuestas[q.text]))
  ).length;
  return Math.round((answered / questions.length) * 100);
}

// ── Source badge ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const m: Record<string, string> = {
    pdf:  'bg-rose-500/15 text-rose-400 border-rose-500/20',
    docx: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    xlsx: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    audio:'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${m[source] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
      {source.toUpperCase()}
    </span>
  );
}

// ── Participant card ────────────────────────────────────────────────────────

function ParticipantCard({ participant, questions }: { participant: Participant; questions: Question[] }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'propuesta' | 'entrevista' | 'resumen'>('resumen');

  const pct = coverage(participant, questions);
  const pctColor = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-rose-400';
  const pctBg    = pct >= 80 ? 'bg-emerald-500'   : pct >= 50 ? 'bg-yellow-500'   : 'bg-rose-500';

  const allEvidences = [...participant.proposals, ...participant.interviews];
  const topAnswers = questions
    .filter(q => allEvidences.some(e => !isEmpty(e.respuestas[q.text])))
    .slice(0, 5);

  return (
    <div className="glass rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300">
      {/* Header */}
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-all">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center text-white font-bold shrink-0">
          {participant.name[0]?.toUpperCase() ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{participant.name}</p>
          <div className="flex items-center gap-3 mt-1">
            {participant.proposals.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-400">
                <FileText className="w-3 h-3" />
                <span>{participant.proposals.length} propuesta{participant.proposals.length > 1 ? 's' : ''}</span>
                {participant.proposals.map(p => <SourceBadge key={p.id} source={p.source_type} />)}
              </div>
            )}
            {participant.interviews.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-cyan-400">
                <Mic className="w-3 h-3" />
                <span>{participant.interviews.length} entrevista{participant.interviews.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`text-lg font-bold ${pctColor}`}>{pct}%</p>
            <p className="text-[10px] text-slate-600">cobertura</p>
          </div>
          <div className="w-1.5 h-12 bg-white/[0.04] rounded-full overflow-hidden">
            <div className={`${pctBg} rounded-full transition-all duration-500`} style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* Detail */}
      {expanded && (
        <div className="border-t border-white/[0.05]">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.05]">
            {(['resumen','propuesta','entrevista'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-cyan-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {tab === 'resumen' ? 'Resumen' : tab === 'propuesta' ? `Propuesta (${participant.proposals.length})` : `Entrevista (${participant.interviews.length})`}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Resumen tab */}
            {activeTab === 'resumen' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
                  Top respuestas ({topAnswers.length}/{questions.length})
                </p>
                {topAnswers.map(q => {
                  const answer = allEvidences.find(e => !isEmpty(e.respuestas[q.text]))?.respuestas[q.text];
                  return (
                    <div key={q.id} className="grid grid-cols-[2fr_3fr] gap-3 text-xs">
                      <p className="text-slate-500 leading-relaxed">{q.text}</p>
                      <p className="text-slate-300 leading-relaxed line-clamp-2">{answer}</p>
                    </div>
                  );
                })}
                {topAnswers.length === 0 && (
                  <p className="text-slate-600 text-sm">Sin respuestas registradas aún.</p>
                )}
              </div>
            )}

            {/* Propuesta tab */}
            {activeTab === 'propuesta' && (
              participant.proposals.length === 0 ? (
                <p className="text-slate-600 text-sm">No hay propuestas cargadas para este participante.</p>
              ) : (
                <div className="space-y-4">
                  {participant.proposals.map(p => (
                    <div key={p.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <SourceBadge source={p.source_type} />
                        <span className="text-xs text-slate-500">{p.fecha}</span>
                      </div>
                      {questions.slice(0, 8).map(q => {
                        const a = p.respuestas[q.text];
                        return !isEmpty(a) ? (
                          <div key={q.id} className="grid grid-cols-[2fr_3fr] gap-3 text-xs">
                            <p className="text-slate-500">{q.text}</p>
                            <p className="text-amber-200/80 leading-relaxed line-clamp-2">{a}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Entrevista tab */}
            {activeTab === 'entrevista' && (
              participant.interviews.length === 0 ? (
                <p className="text-slate-600 text-sm">No hay entrevistas registradas para este participante.</p>
              ) : (
                <div className="space-y-4">
                  {participant.interviews.map(e => (
                    <div key={e.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mic className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-slate-500">{e.fecha}</span>
                      </div>
                      {questions.slice(0, 8).map(q => {
                        const a = e.respuestas[q.text];
                        return !isEmpty(a) ? (
                          <div key={q.id} className="grid grid-cols-[2fr_3fr] gap-3 text-xs">
                            <p className="text-slate-500">{q.text}</p>
                            <p className="text-cyan-200/80 leading-relaxed line-clamp-2">{a}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ParticipantsPage() {
  const { projectId, setProjectId, hydrated } = useProjectContext();
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [participants,  setParticipants]  = useState<Participant[]>([]);
  const [questions,     setQuestions]     = useState<Question[]>([]);
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(false);
  const [totalProposals,setTotalProposals]= useState(0);
  const [totalInter,    setTotalInter]    = useState(0);

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
      const [matrix, q, sp, si] = await Promise.all([
        getInterviewResponsesMatrix({ projectId: pid }),
        getQuestions(pid),
        getDashboardStats({ projectId: pid, moduleType: 'propuesta' }),
        getDashboardStats({ projectId: pid, moduleType: 'exploratorio' }),
      ]);
      setParticipants(buildParticipants(matrix));
      setQuestions(q);
      setTotalProposals(sp.total_entrevistas);
      setTotalInter(si.total_entrevistas);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (projectId) void load(projectId); }, [projectId, load]);

  const filtered = search
    ? participants.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : participants;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px max-w-[40px] w-full bg-gradient-to-r from-cyan-500/50 to-transparent" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-widest">Participantes</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gradient">Proveedores</h1>
          <p className="text-slate-400 mt-2 text-sm">Vista unificada por proveedor — propuestas + entrevistas</p>
        </div>
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      </header>

      {projectId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Participantes', val: participants.length, color: 'text-white' },
              { label: 'Propuestas', val: totalProposals, color: 'text-amber-400' },
              { label: 'Entrevistas', val: totalInter, color: 'text-cyan-400' },
            ].map(s => (
              <div key={s.label} className="glass rounded-2xl p-4 text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar participante..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none" />
          </div>

          {loading && (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              Cargando participantes...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="glass rounded-2xl p-16 text-center">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Sin participantes aún en este proyecto</p>
              <p className="text-slate-600 text-sm mt-1">Carga propuestas o graba entrevistas para ver participantes aquí.</p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map(p => (
              <ParticipantCard key={p.name} participant={p} questions={questions} />
            ))}
          </div>
        </>
      )}

      {!projectId && (
        <div className="glass rounded-2xl p-16 text-center">
          <Users className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-lg">Selecciona un proyecto para ver participantes</p>
        </div>
      )}
    </main>
  );
}
