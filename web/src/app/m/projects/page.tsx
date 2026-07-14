'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ManagedProject, ManagedProjectStatus } from '@whispper/shared';
import {
  createManagedProject,
  deleteManagedProject,
  listManagedProjects,
  updateManagedProject,
} from '@/lib/api';

type ProjectDraft = {
  name: string;
  description: string;
  client: string;
  status: ManagedProjectStatus;
  start_date: string;
  participantsRaw: string;
  files_count: number;
  audios_count: number;
  proposals_count: number;
  analysis_count: number;
};

const STATUS_OPTIONS: Array<{ value: ManagedProjectStatus; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'activo', label: 'Activo' },
  { value: 'en_pausa', label: 'En pausa' },
  { value: 'cerrado', label: 'Cerrado' },
];

function statusBadge(status: ManagedProjectStatus): string {
  if (status === 'activo') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'en_pausa') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'cerrado') return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
}

function parseParticipants(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function emptyDraft(): ProjectDraft {
  return {
    name: '',
    description: '',
    client: '',
    status: 'borrador',
    start_date: '',
    participantsRaw: '',
    files_count: 0,
    audios_count: 0,
    proposals_count: 0,
    analysis_count: 0,
  };
}

export default function ProjectsModulePage() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ManagedProjectStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listManagedProjects({
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        client: clientFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setProjects(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar proyectos');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, clientFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const clients = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.client).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [projects]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function startEdit(project: ManagedProject) {
    setEditingId(project.id);
    setDraft({
      name: project.name,
      description: project.description,
      client: project.client,
      status: project.status,
      start_date: project.start_date ?? '',
      participantsRaw: project.participants.join(', '),
      files_count: project.files_count,
      audios_count: project.audios_count,
      proposals_count: project.proposals_count,
      analysis_count: project.analysis_count,
    });
  }

  async function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError('El nombre del proyecto es obligatorio.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        client: draft.client,
        status: draft.status,
        start_date: draft.start_date || null,
        participants: parseParticipants(draft.participantsRaw),
        files_count: draft.files_count,
        audios_count: draft.audios_count,
        proposals_count: draft.proposals_count,
        analysis_count: draft.analysis_count,
      };
      if (editingId) {
        await updateManagedProject(editingId, payload);
      } else {
        await createManagedProject(payload);
      }
      setDraft(emptyDraft());
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el proyecto');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeProject(id: number) {
    if (!window.confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    try {
      await deleteManagedProject(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el proyecto');
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">Módulo</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Proyectos</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Crea, edita, elimina y filtra proyectos con métricas de participantes, archivos, audios, propuestas y análisis.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
        >
          Nuevo proyecto
        </button>
      </header>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 lg:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción"
            className="xl:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ManagedProjectStatus | 'all')}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
          >
            <option value="all">Todos los estados</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
          >
            <option value="">Todos los clientes</option>
            {clients.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 lg:p-5">
        <form onSubmit={submitDraft} className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {editingId ? `Editar proyecto #${editingId}` : 'Crear proyecto'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Nombre"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              value={draft.client}
              onChange={(e) => setDraft((d) => ({ ...d, client: e.target.value }))}
              placeholder="Cliente"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Descripción"
              rows={2}
              className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <select
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ManagedProjectStatus }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              value={draft.participantsRaw}
              onChange={(e) => setDraft((d) => ({ ...d, participantsRaw: e.target.value }))}
              placeholder="Participantes (separados por coma)"
              className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="number"
              min={0}
              value={draft.files_count}
              onChange={(e) => setDraft((d) => ({ ...d, files_count: Number(e.target.value) || 0 }))}
              placeholder="Archivos"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              type="number"
              min={0}
              value={draft.audios_count}
              onChange={(e) => setDraft((d) => ({ ...d, audios_count: Number(e.target.value) || 0 }))}
              placeholder="Audios"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              type="number"
              min={0}
              value={draft.proposals_count}
              onChange={(e) => setDraft((d) => ({ ...d, proposals_count: Number(e.target.value) || 0 }))}
              placeholder="Propuestas"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
            <input
              type="number"
              min={0}
              value={draft.analysis_count}
              onChange={(e) => setDraft((d) => ({ ...d, analysis_count: Number(e.target.value) || 0 }))}
              placeholder="Análisis"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft());
                }}
                className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </section>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Cargando proyectos...</p>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{project.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {project.client || 'Sin cliente'} · {project.start_date || 'Sin fecha'}
                  </p>
                </div>
                <span className={`px-2 py-1 text-[10px] rounded-full border ${statusBadge(project.status)}`}>
                  {STATUS_OPTIONS.find((s) => s.value === project.status)?.label ?? project.status}
                </span>
              </div>

              <p className="text-sm text-[var(--text-muted)] line-clamp-3 min-h-[54px]">
                {project.description || 'Sin descripción'}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                  Participantes: <span className="font-semibold">{project.participants.length}</span>
                </div>
                <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                  Archivos: <span className="font-semibold">{project.files_count}</span>
                </div>
                <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                  Audios: <span className="font-semibold">{project.audios_count}</span>
                </div>
                <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                  Propuestas: <span className="font-semibold">{project.proposals_count}</span>
                </div>
                <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5 col-span-2">
                  Análisis: <span className="font-semibold">{project.analysis_count}</span>
                </div>
              </div>

              {project.participants.length > 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  Equipo: {project.participants.join(', ')}
                </p>
              )}

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(project)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No hay proyectos con esos filtros.</p>
          )}
        </section>
      )}
    </main>
  );
}

