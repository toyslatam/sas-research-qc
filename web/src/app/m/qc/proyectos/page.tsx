'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcClient, QcProject, QcProjectStatus } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcProject,
  deleteQcProject,
  listQcClients,
  listQcOrganizations,
  listQcProjects,
  updateQcProject,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const STATUS_OPTIONS: Array<{ value: QcProjectStatus; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'activo', label: 'Activo' },
  { value: 'en_pausa', label: 'En pausa' },
  { value: 'cerrado', label: 'Cerrado' },
];

type Draft = {
  name: string;
  code: string;
  description: string;
  status: QcProjectStatus;
  client_id: string;
  country: string;
  methodology: string;
  start_date: string;
  end_date: string;
};

function emptyDraft(): Draft {
  return {
    name: '',
    code: '',
    description: '',
    status: 'borrador',
    client_id: '',
    country: '',
    methodology: '',
    start_date: '',
    end_date: '',
  };
}

function statusClass(status: QcProjectStatus): string {
  if (status === 'activo') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'en_pausa') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'cerrado') return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
}

export default function QcProyectosPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projects, setProjects] = useState<QcProject[]>([]);
  const [clients, setClients] = useState<QcClient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QcProjectStatus | 'all'>('all');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveOrg = useCallback(async () => {
    if (!user?.id) return null;
    const orgs = await listQcOrganizations(user.id);
    const stored = getStoredQcOrgId();
    const active = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
    if (active) setStoredQcOrgId(active.id);
    setOrgId(active?.id ?? null);
    return active?.id ?? null;
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const id = orgId ?? (await resolveOrg());
      if (!id) {
        setProjects([]);
        setClients([]);
        return;
      }
      const [projRows, clientRows] = await Promise.all([
        listQcProjects(id, user.id, {
          search: search || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        listQcClients(id, user.id),
      ]);
      setProjects(projRows);
      setClients(clientRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando proyectos QC');
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, resolveOrg, search, statusFilter]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  function startEdit(p: QcProject) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      code: p.code,
      description: p.description,
      status: p.status,
      client_id: p.client_id != null ? String(p.client_id) : '',
      country: p.country,
      methodology: p.methodology,
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !draft.name.trim()) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      code: draft.code.trim(),
      description: draft.description,
      status: draft.status,
      client_id: draft.client_id ? parseInt(draft.client_id, 10) : null,
      country: draft.country,
      methodology: draft.methodology,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      actorUserId: user.id,
    };
    try {
      if (editingId != null) {
        await updateQcProject(orgId, editingId, payload);
      } else {
        await createQcProject(orgId, payload);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar este proyecto QC?')) return;
    try {
      await deleteQcProject(orgId, id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando proyectos QC…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar proyectos QC.
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Primero crea una organización en{' '}
        <a href="/m/qc/organizacion" className="text-orange-400 underline">
          Organización
        </a>
        .
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Proyectos QC</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Estudios de campo para control de calidad.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o país…"
          className="flex-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QcProjectStatus | 'all')}
          className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Todos los estados</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass(p.status)}`}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? p.status}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {p.code || 'sin código'}
                  {p.client_name ? ` · ${p.client_name}` : ''}
                  {p.country ? ` · ${p.country}` : ''}
                  {p.methodology ? ` · ${p.methodology}` : ''}
                </p>
                {p.description && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">{p.description}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-orange-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
        {projects.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin proyectos QC todavía.</li>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">
          {editingId != null ? 'Editar proyecto' : 'Nuevo proyecto QC'}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nombre *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            placeholder="Código"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={draft.client_id}
            onChange={(e) => setDraft((d) => ({ ...d, client_id: e.target.value }))}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft((d) => ({ ...d, status: e.target.value as QcProjectStatus }))
            }
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={draft.country}
            onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
            placeholder="País"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={draft.methodology}
            onChange={(e) => setDraft((d) => ({ ...d, methodology: e.target.value }))}
            placeholder="Metodología (ej. face-to-face)"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            type="date"
            value={draft.start_date}
            onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            type="date"
            value={draft.end_date}
            onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Descripción"
          rows={2}
          className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
        />
        {clients.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">
            Tip: crea clientes en{' '}
            <a href="/m/qc/clientes" className="text-orange-400 underline">
              Clientes
            </a>{' '}
            para asociarlos al proyecto.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editingId != null ? 'Guardar' : 'Crear proyecto'}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)]"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
