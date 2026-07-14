'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, ChevronRight, FolderPlus, GripVertical } from 'lucide-react';
import type { Category, Project, Question } from '@whispper/shared';
import { apiUrl } from '@/lib/apiBase';
import { useProjectContext } from '@/components/ProjectContext';
import { ProjectSelect } from '@/components/ProjectSelect';
import { pickDefaultProjectId } from '@/lib/projectSelection';

// ── helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none transition-all';

// ── Inline question editor ─────────────────────────────────────────────────

function QuestionEditor({
  question,
  categories,
  defaultCategoryId,
  onSave,
  onCancel,
  isNew = false,
}: {
  question?: Question;
  categories: Category[];
  defaultCategoryId: number | null;
  onSave: (data: { text: string; category_id: number; sub_items: string }) => Promise<void>;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const [text,       setText]      = useState(question?.text ?? '');
  const [subItems,   setSubItems]  = useState((question?.sub_items ?? []).join('\n'));
  const [catId,      setCatId]     = useState<number | ''>(
    question?.category_id ?? defaultCategoryId ?? (categories[0]?.id ?? '')
  );
  const [saving,     setSaving]    = useState(false);
  const [showSubs,   setShowSubs]  = useState((question?.sub_items ?? []).length > 0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!text.trim() || !catId) return;
    setSaving(true);
    try { await onSave({ text: text.trim(), category_id: catId as number, sub_items: subItems }); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass rounded-xl p-4 space-y-3 animate-slide-up">
      <textarea
        ref={textRef}
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="¿Cuál es la pregunta del cuestionario?"
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        className={inputCls}
      />

      {/* Sub-items toggle */}
      <button type="button" onClick={() => setShowSubs(!showSubs)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
        <ChevronRight className={`w-3 h-3 transition-transform ${showSubs ? 'rotate-90' : ''}`} />
        Sub-ítems {showSubs ? '(ocultar)' : '(opcional — la IA evalúa cada uno)'}
      </button>

      {showSubs && (
        <textarea rows={3} value={subItems} onChange={e => setSubItems(e.target.value)}
          placeholder={'Uno por línea:\nCálculo de nómina\nPago de impuestos\nReporting'}
          className={inputCls + ' text-xs'} />
      )}

      <div className="flex items-center gap-3">
        <select value={catId} onChange={e => setCatId(e.target.value ? parseInt(e.target.value, 10) : '')}
          className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 focus:outline-none">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={handleSave} disabled={saving || !text.trim() || !catId}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40 transition-all">
          <Check className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel}
          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { projectId: selectedProjectId, setProjectId: setSelectedProjectId, hydrated } = useProjectContext();
  const [projects,           setProjects]          = useState<Project[]>([]);
  const [categories,         setCategories]        = useState<Category[]>([]);
  const [questions,          setQuestions]         = useState<Question[]>([]);
  const [selectedCatId,      setSelectedCatId]     = useState<number | null>(null);
  const [editingQId,         setEditingQId]        = useState<number | null>(null);
  const [addingQuestion,     setAddingQuestion]    = useState(false);
  const [showNewProject,     setShowNewProject]    = useState(false);
  const [loadError,          setLoadError]         = useState<string | null>(null);
  const [error,              setError]             = useState<string | null>(null);

  // new project form
  const [newName,   setNewName]   = useState('');
  const [newClient, setNewClient] = useState('');

  // new category inline
  const [addingCat,  setAddingCat]  = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // edit category
  const [editingCatId,   setEditingCatId]   = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // ── loaders ──────────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(apiUrl('/api/projects'));
      if (!r.ok) throw new Error();
      const p = await r.json() as Project[];
      setProjects(p);
    } catch { setLoadError('No se pudo conectar con el API.'); }
  }, []);

  useEffect(() => {
    if (!hydrated || projects.length === 0 || selectedProjectId) return;
    const id = pickDefaultProjectId(projects);
    if (id) setSelectedProjectId(id);
  }, [hydrated, projects, selectedProjectId, setSelectedProjectId]);

  const loadCategories = useCallback(async (pid: number) => {
    const r = await fetch(apiUrl(`/api/projects/${pid}/categories`));
    const data = await r.json() as Category[];
    setCategories(data);
    if (data.length && !selectedCatId) setSelectedCatId(data[0].id);
  }, [selectedCatId]);

  const loadQuestions = useCallback(async (pid: number) => {
    const r = await fetch(apiUrl(`/api/projects/${pid}/questions`));
    setQuestions(await r.json());
  }, []);

  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => {
    if (!selectedProjectId) return;
    void loadCategories(selectedProjectId);
    void loadQuestions(selectedProjectId);
  }, [selectedProjectId]);

  // ── project CRUD ─────────────────────────────────────────────────────────

  const createProject = async () => {
    if (!newName.trim()) return;
    await fetch(apiUrl('/api/projects'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, client: newClient }),
    });
    setNewName(''); setNewClient(''); setShowNewProject(false);
    void loadProjects();
  };

  // ── category CRUD ─────────────────────────────────────────────────────────

  const createCategory = async () => {
    if (!newCatName.trim() || !selectedProjectId) return;
    await fetch(apiUrl(`/api/projects/${selectedProjectId}/categories`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName }),
    });
    setNewCatName(''); setAddingCat(false);
    void loadCategories(selectedProjectId);
  };

  const saveCategory = async (catId: number) => {
    if (!editingCatName.trim() || !selectedProjectId) return;
    await fetch(apiUrl(`/api/projects/${selectedProjectId}/categories/${catId}`), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCatName }),
    });
    setEditingCatId(null);
    void loadCategories(selectedProjectId);
  };

  const deleteCategory = async (catId: number) => {
    if (!selectedProjectId) return;
    const r = await fetch(apiUrl(`/api/projects/${selectedProjectId}/categories/${catId}`), { method: 'DELETE' });
    if (!r.ok && r.status !== 204) {
      const d = await r.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Error al eliminar');
      return;
    }
    if (selectedCatId === catId) setSelectedCatId(null);
    void loadCategories(selectedProjectId);
  };

  // ── question CRUD ─────────────────────────────────────────────────────────

  const createQuestion = async (data: { text: string; category_id: number; sub_items: string }) => {
    if (!selectedProjectId) return;
    const r = await fetch(apiUrl(`/api/projects/${selectedProjectId}/questions`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError((d as { error?: string }).error ?? 'Error al crear'); return;
    }
    setAddingQuestion(false);
    if (!selectedCatId) setSelectedCatId(data.category_id);
    void loadQuestions(selectedProjectId);
  };

  const updateQuestion = async (qId: number, data: { text: string; category_id: number; sub_items: string }) => {
    if (!selectedProjectId) return;
    const r = await fetch(apiUrl(`/api/projects/${selectedProjectId}/questions/${qId}`), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Error'); return; }
    setEditingQId(null);
    void loadQuestions(selectedProjectId);
  };

  const deleteQuestion = async (qId: number) => {
    if (!selectedProjectId || !confirm('¿Eliminar esta pregunta?')) return;
    await fetch(apiUrl(`/api/projects/${selectedProjectId}/questions/${qId}`), { method: 'DELETE' });
    void loadQuestions(selectedProjectId);
  };

  // ── derived ──────────────────────────────────────────────────────────────

  const filteredQuestions = selectedCatId
    ? questions.filter(q => q.category_id === selectedCatId || q.category === categories.find(c => c.id === selectedCatId)?.name)
    : questions;

  const catQCount = (catId: number) =>
    questions.filter(q => q.category_id === catId || q.category === categories.find(c => c.id === catId)?.name).length;

  const selectedCatObj = categories.find(c => c.id === selectedCatId);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>

      {/* ── TOP HEADER ── */}
      <header className="px-6 py-3 border-b border-white/[0.06] bg-[#050d1a]/60 flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white tracking-tight">Cuestionario</h1>
          <p className="text-xs text-slate-500">Gestiona proyectos, categorías y preguntas</p>
        </div>

        {/* Project selector */}
        <ProjectSelect
          projects={projects}
          value={selectedProjectId}
          onChange={(id) => { setSelectedCatId(null); setSelectedProjectId(id); }}
          compact
          className="min-w-[200px]"
        />

        <button type="button" onClick={() => setShowNewProject(!showNewProject)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-all">
          <FolderPlus className="w-3.5 h-3.5" /> Nuevo proyecto
        </button>
      </header>

      {/* New project inline panel */}
      {showNewProject && (
        <div className="px-6 py-4 border-b border-white/[0.06] bg-violet-500/5 shrink-0 animate-slide-up">
          <div className="max-w-lg flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre del proyecto" className={inputCls}
                onKeyDown={e => { if (e.key === 'Enter') void createProject(); }} />
              <input value={newClient} onChange={e => setNewClient(e.target.value)}
                placeholder="Cliente (opcional)" className={inputCls} />
            </div>
            <button type="button" onClick={() => void createProject()} disabled={!newName.trim()}
              className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition-all text-sm font-medium">
              Crear
            </button>
            <button type="button" onClick={() => setShowNewProject(false)}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.04]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm shrink-0">⚠ {loadError}</div>
      )}

      {/* ── EMPTY STATE ── */}
      {!selectedProjectId && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <FolderPlus className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">Selecciona un proyecto para gestionar su cuestionario</p>
            <p className="text-slate-600 text-sm mt-1">O crea uno nuevo con el botón de arriba</p>
          </div>
        </div>
      )}

      {/* ── SPLIT PANEL ── */}
      {selectedProjectId && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT: CATEGORIES ── */}
          <aside className="w-64 border-r border-white/[0.06] flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categorías</p>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto py-2">
              {/* All questions */}
              <button type="button" onClick={() => setSelectedCatId(null)}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-all ${!selectedCatId ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'}`}>
                <span>Todas las preguntas</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!selectedCatId ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.06] text-slate-500'}`}>
                  {questions.length}
                </span>
              </button>

              {categories.map(cat => {
                const isActive = selectedCatId === cat.id;
                const count = catQCount(cat.id);
                return (
                  <div key={cat.id} className={`group flex items-center px-4 py-2 transition-all ${isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input value={editingCatName} onChange={e => setEditingCatName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void saveCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                          className="flex-1 text-xs px-2 py-1 rounded-lg border border-cyan-500/30 bg-white/[0.04] text-white focus:outline-none" autoFocus />
                        <button type="button" onClick={() => void saveCategory(cat.id)} className="text-cyan-400 hover:text-cyan-300"><Check className="w-3 h-3" /></button>
                        <button type="button" onClick={() => setEditingCatId(null)} className="text-slate-500 hover:text-slate-300"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => setSelectedCatId(cat.id)} className="flex-1 flex items-center justify-between text-sm text-left">
                          <span className={isActive ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-200'}>
                            {cat.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.04] text-slate-600'}`}>
                            {count}
                          </span>
                        </button>
                        <div className="hidden group-hover:flex items-center gap-1 ml-1">
                          <button type="button" title="Renombrar"
                            onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                            className="text-slate-600 hover:text-slate-300 p-0.5"><Pencil className="w-3 h-3" /></button>
                          {count === 0 && (
                            <button type="button" title="Eliminar" onClick={() => void deleteCategory(cat.id)}
                              className="text-slate-600 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New category */}
            <div className="px-4 py-3 border-t border-white/[0.05] shrink-0">
              {addingCat ? (
                <div className="space-y-2">
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} autoFocus
                    placeholder="Nombre de la categoría"
                    onKeyDown={e => { if (e.key === 'Enter') void createCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); }}}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void createCategory()} disabled={!newCatName.trim()}
                      className="flex-1 text-xs py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 disabled:opacity-40 hover:bg-cyan-500/25 transition-all">
                      Crear
                    </button>
                    <button type="button" onClick={() => { setAddingCat(false); setNewCatName(''); }}
                      className="px-2 py-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingCat(true)}
                  className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 py-1 transition-colors">
                  <Plus className="w-3 h-3" /> Nueva categoría
                </button>
              )}
            </div>
          </aside>

          {/* ── RIGHT: QUESTIONS ── */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            {/* Questions header */}
            <div className="px-6 py-3 border-b border-white/[0.05] flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedCatObj ? selectedCatObj.name : 'Todas las preguntas'}
                </p>
                <p className="text-xs text-slate-500">
                  {filteredQuestions.length} pregunta{filteredQuestions.length !== 1 ? 's' : ''}
                  {selectedCatObj?.description && ` — ${selectedCatObj.description}`}
                </p>
              </div>
              {categories.length === 0 && (
                <span className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  Crea una categoría primero
                </span>
              )}
            </div>

            {error && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs shrink-0">
                {error}
                <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-200">✕</button>
              </div>
            )}

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {filteredQuestions.length === 0 && !addingQuestion && (
                <div className="text-center py-16">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">
                    {categories.length === 0
                      ? 'Crea una categoría en el panel izquierdo para empezar'
                      : 'No hay preguntas en esta categoría'}
                  </p>
                  {categories.length > 0 && (
                    <button type="button" onClick={() => setAddingQuestion(true)}
                      className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                      + Agregar la primera pregunta
                    </button>
                  )}
                </div>
              )}

              {filteredQuestions.map((q, i) => (
                <div key={q.id}>
                  {editingQId === q.id ? (
                    <QuestionEditor
                      question={q} categories={categories}
                      defaultCategoryId={selectedCatId}
                      onSave={d => updateQuestion(q.id, d)}
                      onCancel={() => setEditingQId(null)}
                    />
                  ) : (
                    <div className="group glass rounded-xl px-4 py-3 flex items-start gap-3 hover:border-white/[0.12] transition-all">
                      <GripVertical className="w-4 h-4 text-slate-700 mt-0.5 shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-slate-600 font-mono mt-0.5 shrink-0">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm text-slate-200 leading-relaxed">{q.text}</p>
                        </div>
                        {q.sub_items?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 ml-6">
                            {q.sub_items.map(si => (
                              <span key={si} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-500 border border-white/[0.06]">
                                {si}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => { setEditingQId(q.id); setAddingQuestion(false); }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => void deleteQuestion(q.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* New question inline form */}
              {addingQuestion && (
                <QuestionEditor
                  categories={categories} defaultCategoryId={selectedCatId}
                  onSave={createQuestion}
                  onCancel={() => setAddingQuestion(false)}
                  isNew
                />
              )}

              {/* Bottom spacer for FAB */}
              <div className="h-20" />
            </div>

            {/* ── FAB ── */}
            {categories.length > 0 && !addingQuestion && (
              <button type="button"
                onClick={() => { setAddingQuestion(true); setEditingQId(null); }}
                className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm shadow-glow-cyan transition-all active:scale-95">
                <Plus className="w-4 h-4" />
                Nueva pregunta
              </button>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
