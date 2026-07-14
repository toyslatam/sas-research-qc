'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { QcProject, QcSurvey, QcSurveyStatus } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcSurvey,
  deleteQcSurvey,
  listQcOrganizations,
  listQcProjects,
  listQcSurveys,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const STATUS_OPTIONS: Array<{ value: QcSurveyStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'en_auditoria', label: 'En auditoría' },
];

function statusClass(status: QcSurveyStatus): string {
  if (status === 'aprobada') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'rechazada') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (status === 'en_revision') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'en_auditoria') return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
  return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
}

export default function QcEncuestasPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<QcSurvey[]>([]);
  const [projects, setProjects] = useState<QcProject[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QcSurveyStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [draftProjectId, setDraftProjectId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [respondent, setRespondent] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
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
        setSurveys([]);
        setProjects([]);
        return;
      }
      const [surv, projs] = await Promise.all([
        listQcSurveys(id, user.id, {
          search: search || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          projectId: projectFilter === 'all' ? undefined : parseInt(projectFilter, 10),
        }),
        listQcProjects(id, user.id),
      ]);
      setSurveys(surv);
      setProjects(projs);
      if (!draftProjectId && projs[0]) setDraftProjectId(String(projs[0].id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando encuestas');
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, resolveOrg, search, statusFilter, projectFilter, draftProjectId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !draftProjectId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createQcSurvey(orgId, {
        project_id: parseInt(draftProjectId, 10),
        external_id: externalId.trim(),
        respondent_code: respondent.trim(),
        interviewer: interviewer.trim(),
        phone: phone.trim(),
        address: address.trim(),
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        actorUserId: user.id,
      });
      setExternalId('');
      setRespondent('');
      setInterviewer('');
      setPhone('');
      setAddress('');
      setLat('');
      setLng('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar esta encuesta y sus revisiones?')) return;
    try {
      await deleteQcSurvey(orgId, id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando encuestas…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar encuestas QC.
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
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Encuestas</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Cola de QC con etapas de ubicación, contenido y teléfono.
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
          placeholder="Buscar ID, encuestado, entrevistador…"
          className="flex-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm outline-none focus:border-orange-500/40 text-[var(--text-primary)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QcSurveyStatus | 'all')}
          className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {surveys.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/m/qc/encuestas/${s.id}`}
                  className="text-sm font-medium text-[var(--text-primary)] hover:text-orange-300"
                >
                  {s.external_id || s.respondent_code || `Encuesta #${s.id}`}
                </Link>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass(s.status)}`}>
                  {s.status}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">etapa: {s.current_stage}</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {s.project_name || `Proyecto ${s.project_id}`}
                {s.interviewer ? ` · ${s.interviewer}` : ''}
                {s.phone ? ` · ${s.phone}` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/m/qc/encuestas/${s.id}`}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-orange-300"
              >
                Revisar
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {surveys.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin encuestas todavía.</li>
        )}
      </ul>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Nueva encuesta</h2>
        {projects.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)]">
            Crea primero un proyecto en{' '}
            <a href="/m/qc/proyectos" className="text-orange-400 underline">
              Proyectos QC
            </a>
            .
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                required
                value={draftProjectId}
                onChange={(e) => setDraftProjectId(e.target.value)}
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="ID externo"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={respondent}
                onChange={(e) => setRespondent(e.target.value)}
                placeholder="Código encuestado"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="Entrevistador"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección / ubicación"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitud"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Longitud"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Creando…' : 'Crear encuesta'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
