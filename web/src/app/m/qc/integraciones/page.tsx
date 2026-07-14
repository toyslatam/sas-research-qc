'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  QcIntegration,
  QcIntegrationProvider,
  QcIntegrationRun,
  QcIntegrationStatus,
  QcProject,
} from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcIntegration,
  deleteQcIntegration,
  listQcIntegrationRuns,
  listQcIntegrations,
  listQcOrganizations,
  listQcProjects,
  syncQcIntegration,
  updateQcIntegration,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

function statusClass(status: string): string {
  if (status === 'active' || status === 'success') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (status === 'error') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (status === 'partial') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-white/5 text-[var(--text-muted)] border-[var(--border-subtle)]';
}

export default function QcIntegracionesPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<QcIntegration[]>([]);
  const [projects, setProjects] = useState<QcProject[]>([]);
  const [runs, setRuns] = useState<QcIntegrationRun[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<QcIntegrationProvider>('google_sheets');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<QcIntegrationStatus>('active');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('QC');
  const [zohoUrl, setZohoUrl] = useState('');
  const [zohoToken, setZohoToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
        setItems([]);
        return;
      }
      setStoredQcOrgId(active.id);
      setOrgId(active.id);
      const [ints, projs] = await Promise.all([
        listQcIntegrations(active.id, user.id),
        listQcProjects(active.id, user.id),
      ]);
      setItems(ints);
      setProjects(projs);
      if (!selectedId && ints[0]) setSelectedId(ints[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando integraciones');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  useEffect(() => {
    if (!user?.id || !orgId || !selectedId) {
      setRuns([]);
      return;
    }
    listQcIntegrationRuns(orgId, selectedId, user.id)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, [user?.id, orgId, selectedId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !name.trim()) return;
    if (!projectId) {
      setError('Selecciona un proyecto QC (obligatorio para importar encuestas)');
      return;
    }
    setBusy(true);
    setError(null);
    const config =
      provider === 'google_sheets'
        ? { spreadsheet_id: spreadsheetId.trim(), sheet_name: sheetName.trim() || 'QC' }
        : { api_url: zohoUrl.trim(), access_token: zohoToken.trim() };
    try {
      const row = await createQcIntegration(orgId, {
        name: name.trim(),
        provider,
        project_id: projectId ? parseInt(projectId, 10) : null,
        status,
        config,
        actorUserId: user.id,
      });
      setName('');
      setSpreadsheetId('');
      setZohoUrl('');
      setZohoToken('');
      setSelectedId(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function handleSync(id: number) {
    if (!user?.id || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await syncQcIntegration(orgId, id, user.id);
      setSelectedId(id);
      setItems((prev) => prev.map((x) => (x.id === id ? result.integration : x)));
      setRuns((prev) => [result.run, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync falló');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: QcIntegration) {
    if (!user?.id || !orgId) return;
    try {
      const next = item.status === 'active' ? 'inactive' : 'active';
      const updated = await updateQcIntegration(orgId, item.id, {
        status: next,
        actorUserId: user.id,
      });
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar esta integración?')) return;
    try {
      await deleteQcIntegration(orgId, id, user.id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando integraciones…
      </div>
    );
  }

  if (!user || !orgId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        {!user
          ? 'Inicia sesión para gestionar integraciones.'
          : 'Crea primero una organización QC.'}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Integraciones</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Sync importa filas a encuestas QC (crea o actualiza por{' '}
          <code className="text-[11px] text-orange-300/90">external_id</code>). Requiere proyecto
          asignado.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border px-4 py-3 ${
              selectedId === item.id
                ? 'border-orange-500/40 bg-orange-500/5'
                : 'border-[var(--border-subtle)] bg-[var(--bg-card)]/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="text-left min-w-0 space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{item.provider}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {item.project_name || 'Sin proyecto'}
                  {item.last_sync_at
                    ? ` · sync ${new Date(item.last_sync_at).toLocaleString()}`
                    : ' · sin sync'}
                  {item.last_sync_message ? ` · ${item.last_sync_message}` : ''}
                </p>
              </button>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSync(item.id)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/90 text-white disabled:opacity-50"
                >
                  Sync
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)]"
                >
                  {item.status === 'active' ? 'Pausar' : 'Activar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin integraciones todavía.</li>
        )}
      </ul>

      {selectedId != null && runs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Últimas ejecuciones</h2>
          <ul className="space-y-1">
            {runs.slice(0, 8).map((run) => {
              const payload = run.result_payload ?? {};
              const created = typeof payload.created === 'number' ? payload.created : null;
              const updated = typeof payload.updated === 'number' ? payload.updated : null;
              return (
                <li
                  key={run.id}
                  className="text-xs text-[var(--text-muted)] rounded-lg border border-[var(--border-subtle)] px-3 py-2"
                >
                  <span className={`mr-2 px-1.5 py-0.5 rounded border ${statusClass(run.status)}`}>
                    {run.status}
                  </span>
                  {run.message}
                  {created != null && updated != null
                    ? ` · +${created} / ~${updated}`
                    : ` · importados ${run.imported_count}`}
                  {' · '}
                  omitidos {run.skipped_count}
                  {run.error_count > 0 ? ` · errores ${run.error_count}` : ''}
                  {' · '}
                  {new Date(run.started_at).toLocaleString()}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Nueva integración</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as QcIntegrationProvider)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="google_sheets">Google Sheets</option>
            <option value="zoho">Zoho</option>
          </select>
          <select
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Proyecto QC * (obligatorio para sync)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as QcIntegrationStatus)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
          {provider === 'google_sheets' ? (
            <>
              <input
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Spreadsheet ID"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Hoja (ej. QC)"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
            </>
          ) : (
            <>
              <input
                value={zohoUrl}
                onChange={(e) => setZohoUrl(e.target.value)}
                placeholder="Zoho API URL"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
              <input
                value={zohoToken}
                onChange={(e) => setZohoToken(e.target.value)}
                placeholder="Access token"
                className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
              />
            </>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Columnas reconocidas (Sheets/Zoho):{' '}
          <span className="text-orange-300/80">
            external_id (o folio/id), respondent_code, interviewer, phone/telefono, address/direccion,
            latitude/lat, longitude/lng, collected_at/fecha
          </span>
          . El resto va a <code className="text-[10px]">answers</code>. Sin credenciales Google se
          importa un lote demo.
        </p>
        <button
          type="submit"
          disabled={busy || !projectId}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Guardando…' : 'Crear integración'}
        </button>
      </form>
    </div>
  );
}
