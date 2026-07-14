'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Category } from '@whispper/shared';

import { apiUrl } from '@/lib/apiBase';

interface Props {
  projectId: number;
  onChange?: () => void;
}

export function CategoryManager({ projectId, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const base = apiUrl(`/api/projects/${projectId}/categories`);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(base);
    if (!res.ok) {
      setError('No se pudieron cargar las categorías');
      return;
    }
    setCategories(await res.json());
    onChange?.();
  }, [base, onChange]);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = async () => {
    if (!name.trim()) return;
    setError(null);
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error || 'Error al crear');
      return;
    }
    setName('');
    setDescription('');
    load();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description);
  };

  const saveEdit = async () => {
    if (editingId === null || !editName.trim()) return;
    setError(null);
    const res = await fetch(`${base}/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDescription }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error || 'Error al guardar');
      return;
    }
    setEditingId(null);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    setError(null);
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const data = await res.json();
      setError((data as { error?: string }).error ?? null);
      return;
    }
    if (!res.ok && res.status !== 204) {
      setError('Error al eliminar');
      return;
    }
    load();
  };

  return (
    <div className="mb-8 pb-8 border-b border-slate-800">
      <h2 className="font-semibold mb-1">Categorías</h2>
      <p className="text-sm text-slate-500 mb-4">
        Define los temas de la entrevista (ej. estructura de precios EOR). Las preguntas se
        agrupan por categoría para el análisis.
      </p>

      {error && (
        <p className="text-sm text-red-400 mb-3 p-2 bg-red-950/40 rounded-lg">{error}</p>
      )}

      <ul className="space-y-3 mb-5">
        {categories.length === 0 && (
          <li className="text-slate-500 text-sm">Aún no hay categorías en este proyecto.</li>
        )}
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="p-3 rounded-lg border border-slate-800 bg-slate-950/50"
          >
            {editingId === cat.id ? (
              <div className="space-y-2">
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nombre de la categoría"
                />
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción opcional (ayuda al análisis IA)"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="text-sm bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 rounded-lg"
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
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">{cat.name}</p>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(cat.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <input
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          placeholder="Nombre de la categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          rows={2}
          placeholder="Descripción del tema (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          onClick={addCategory}
          className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg font-medium text-sm"
        >
          Agregar categoría
        </button>
      </div>
    </div>
  );
}
