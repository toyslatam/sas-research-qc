'use client';

import { useState } from 'react';
import type { Category, Question } from '@whispper/shared';
import { apiUrl } from '@/lib/apiBase';

interface Props {
  projectId: number;
  questions: Question[];
  categories: Category[];
  onUpdated: () => void;
}

export function QuestionList({ projectId, questions, categories, onUpdated }: Props) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editSubItems, setEditSubItems] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const questionUrl = (questionId: number) =>
    apiUrl(`/api/projects/${projectId}/questions/${questionId}`);

  const patchQuestion = async (
    questionId: number,
    body: { text?: string; category_id?: number; sub_items?: string }
  ) => {
    setSavingId(questionId);
    setError(null);
    try {
      const res = await fetch(questionUrl(questionId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error al guardar');
      }
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
      throw e;
    } finally {
      setSavingId(null);
    }
  };

  const changeCategory = async (questionId: number, categoryId: number) => {
    await patchQuestion(questionId, { category_id: categoryId });
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditSubItems((q.sub_items ?? []).join('\n'));
    setEditCategoryId(
      q.category_id ?? categories.find((c) => c.name === q.category)?.id ?? ''
    );
    setError(null);
  };

  const saveEdit = async () => {
    if (editingId === null || !editText.trim() || !editCategoryId) return;
    try {
      await patchQuestion(editingId, {
        text: editText.trim(),
        category_id: editCategoryId,
        sub_items: editSubItems,
      });
      setEditingId(null);
    } catch {
      /* error shown in state */
    }
  };

  const remove = async (questionId: number) => {
    if (!confirm('¿Eliminar esta pregunta del cuestionario?')) return;
    setSavingId(questionId);
    setError(null);
    try {
      const res = await fetch(questionUrl(questionId), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Error al eliminar');
      }
      if (editingId === questionId) setEditingId(null);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setSavingId(null);
    }
  };

  if (questions.length === 0) {
    return <p className="text-slate-500 text-sm mb-6">No hay preguntas aún.</p>;
  }

  return (
    <div className="space-y-3 mb-6">
      {error && (
        <p className="text-sm text-red-400 p-2 bg-red-950/40 rounded-lg">{error}</p>
      )}
      {questions.map((q, index) => {
        const selectedCategoryId =
          q.category_id ?? categories.find((c) => c.name === q.category)?.id ?? '';

        const isEditing = editingId === q.id;
        const isBusy = savingId === q.id;

        return (
          <div
            key={q.id}
            className="p-3 rounded-lg border border-slate-800 bg-slate-950/50"
          >
            {isEditing ? (
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">
                  Pregunta {index + 1}
                </label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <label className="block text-xs text-slate-500">
                  Sub-ítems (uno por línea, opcional)
                </label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  rows={4}
                  value={editSubItems}
                  onChange={(e) => setEditSubItems(e.target.value)}
                />
                <label className="block text-xs text-slate-500">Categoría</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
                  value={editCategoryId}
                  onChange={(e) =>
                    setEditCategoryId(
                      e.target.value ? parseInt(e.target.value, 10) : ''
                    )
                  }
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={isBusy || !editText.trim() || !editCategoryId}
                    className="text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-3 py-1.5 rounded-lg"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                <div className="text-slate-300 text-sm flex-1 min-w-0">
                  <p>
                    <span className="text-slate-500 mr-2">{index + 1}.</span>
                    {q.text}
                  </p>
                  {q.sub_items?.length > 0 && (
                    <ul className="mt-2 ml-6 list-disc text-xs text-slate-400 space-y-0.5">
                      {q.sub_items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="shrink-0 w-full sm:w-56 space-y-1">
                  <label className="block text-xs text-slate-500">Categoría</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm disabled:opacity-50"
                    value={selectedCategoryId}
                    disabled={isBusy || categories.length === 0}
                    onChange={(e) => {
                      const catId = parseInt(e.target.value, 10);
                      if (!catId) return;
                      changeCategory(q.id, catId);
                    }}
                  >
                    {!selectedCategoryId && (
                      <option value="">Elegir categoría…</option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => startEdit(q)}
                      disabled={isBusy}
                      className="text-xs text-cyan-400 hover:underline disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      disabled={isBusy}
                      className="text-xs text-red-400 hover:underline disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                  {isBusy && (
                    <span className="text-xs text-slate-500 block">Procesando…</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
