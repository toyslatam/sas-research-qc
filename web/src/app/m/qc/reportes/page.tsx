'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcProject, QcReportExportLog, QcReportSummary } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  getQcReportSummary,
  listQcOrganizations,
  listQcProjects,
  listQcReportExports,
  downloadQcReport,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const STATUSES = ['', 'pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_auditoria'];

export default function QcReportesPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projects, setProjects] = useState<QcProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState<QcReportSummary | null>(null);
  const [exports, setExports] = useState<QcReportExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const orgs = await listQcOrganizations(user.id);
      const stored = getStoredQcOrgId();
      const active = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
      if (!active) {
        setOrgId(null);
        return;
      }
      setStoredQcOrgId(active.id);
      setOrgId(active.id);
      const [projs, logs] = await Promise.all([
        listQcProjects(active.id, user.id),
        listQcReportExports(active.id, user.id).catch(() => [] as QcReportExportLog[]),
      ]);
      setProjects(projs);
      setExports(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reportes');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) loadBase();
  }, [authLoading, loadBase]);

  async function handleGenerate() {
    if (!user?.id || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const filters = {
        projectId: projectId ? parseInt(projectId, 10) : undefined,
        status: status || undefined,
      };
      const data = await getQcReportSummary(orgId, user.id, filters);
      setSummary(data);
      setExports(await listQcReportExports(orgId, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el reporte');
    } finally {
      setBusy(false);
    }
  }

  function downloadFilters() {
    return {
      projectId: projectId ? parseInt(projectId, 10) : undefined,
      status: status || undefined,
    };
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando reportes…
      </div>
    );
  }

  if (!user || !orgId) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        {!user ? 'Inicia sesión para ver reportes.' : 'Crea primero una organización QC.'}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Reportes QC</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Resumen de revisiones y exportación CSV / JSON (compatible con Excel).
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Filtros</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? s : 'Todos los estados'}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleGenerate()}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {busy ? 'Generando…' : 'Generar resumen'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadQcReport(orgId, 'csv', downloadFilters()).catch((e) =>
                setError(e instanceof Error ? e.message : 'No se pudo descargar el CSV'),
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-orange-300 hover:border-orange-500/40"
          >
            Descargar CSV
          </button>
          <button
            type="button"
            onClick={() =>
              downloadQcReport(orgId, 'json', downloadFilters()).catch((e) =>
                setError(e instanceof Error ? e.message : 'No se pudo descargar el JSON'),
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-orange-300 hover:border-orange-500/40"
          >
            Descargar JSON
          </button>
        </div>
      </section>

      {summary && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">Encuestas</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {summary.totals.surveys}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">Evidencias</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {summary.totals.evidences}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">Rechazadas</p>
              <p className="text-2xl font-semibold text-rose-400">
                {summary.totals.by_status.rechazada ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3">
              <p className="text-[11px] text-[var(--text-muted)]">Aprobadas</p>
              <p className="text-2xl font-semibold text-emerald-400">
                {summary.totals.by_status.aprobada ?? 0}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Detalle</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-2 pr-2 font-medium">ID / Ext</th>
                    <th className="py-2 px-2 font-medium">Proyecto</th>
                    <th className="py-2 px-2 font-medium">Estado</th>
                    <th className="py-2 px-2 font-medium">Etapas</th>
                    <th className="py-2 px-2 font-medium">Evid.</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.slice(0, 50).map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-subtle)]/50">
                      <td className="py-2 pr-2 text-[var(--text-primary)]">
                        #{r.id}
                        {r.external_id ? ` · ${r.external_id}` : ''}
                      </td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{r.project_name}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{r.status}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">
                        U:{r.stage_ubicacion[0]} C:{r.stage_contenido[0]} T:{r.stage_telefono[0]}
                      </td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{r.evidences_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.rows.length > 50 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  Mostrando 50 de {summary.rows.length}. Usa CSV para el listado completo.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {exports.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Exportaciones recientes</h2>
          <ul className="space-y-1">
            {exports.slice(0, 8).map((ex) => (
              <li
                key={ex.id}
                className="text-xs text-[var(--text-muted)] rounded-lg border border-[var(--border-subtle)] px-3 py-2"
              >
                {ex.format} · {ex.row_count} filas · {new Date(ex.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
