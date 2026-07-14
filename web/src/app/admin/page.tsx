'use client';

import { useEffect, useState } from 'react';
import { getAdminOverview, getAdminSettings, listAuditLogs, updateAdminSettings } from '@/lib/api';

export default function AdminPage() {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAdminOverview(), getAdminSettings(), listAuditLogs(50)])
      .then(([o, s, l]) => {
        setOverview(o);
        setSettings(s);
        setLogs(l);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando admin'));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminSettings({
        openai_model: settings.openai_model,
        google_sheets_enabled: settings.google_sheets_enabled,
        google_drive_enabled: settings.google_drive_enabled,
        general_notes: settings.general_notes,
      });
      setSettings(updated);
      setLogs(await listAuditLogs(50));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const runtime = (settings?.runtime as Record<string, unknown> | undefined) ?? {};
  const roles = (overview?.roles as string[]) ?? [];
  const permissions = (overview?.permissions as string[]) ?? [];
  const modules = [
    'Research Intelligence',
    'Proyectos',
    'IA',
    'Propuestas',
    'Informes Configurados',
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Panel</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Administración</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Usuarios/roles (schema), módulos, integraciones, logs y configuración general.
        </p>
      </header>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">{error}</div>}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
          <h2 className="font-semibold">Roles</h2>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r} className="px-2 py-1 rounded-full text-[10px] border border-[var(--border-subtle)]">{r}</span>
            ))}
          </div>
          <h3 className="font-medium text-sm pt-2">Permisos</h3>
          <ul className="text-xs text-[var(--text-muted)] space-y-1">
            {permissions.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </article>

        <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
          <h2 className="font-semibold">Módulos visibles</h2>
          <ul className="text-sm space-y-1">
            {modules.map((m) => (
              <li key={m} className="flex items-center justify-between border-b border-[var(--border-subtle)] py-1">
                <span>{m}</span>
                <span className="text-[10px] text-emerald-400">visible</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <h2 className="font-semibold">Configuración general / integraciones</h2>
        {settings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span>Modelo OpenAI (preferido)</span>
              <input
                value={String(settings.openai_model ?? '')}
                onChange={(e) => setSettings({ ...settings, openai_model: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm space-y-1">
              <span>Notas generales</span>
              <input
                value={String(settings.general_notes ?? '')}
                onChange={(e) => setSettings({ ...settings, general_notes: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.google_sheets_enabled)}
                onChange={(e) => setSettings({ ...settings, google_sheets_enabled: e.target.checked })}
              />
              Google Sheets habilitado (preferencia UI)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(settings.google_drive_enabled)}
                onChange={(e) => setSettings({ ...settings, google_drive_enabled: e.target.checked })}
              />
              Google Drive habilitado (preferencia UI)
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-[var(--bg-hover)] p-2">OpenAI env: <b>{String(runtime.openai_configured)}</b></div>
          <div className="rounded bg-[var(--bg-hover)] p-2">Modelo env: <b>{String(runtime.openai_model_env)}</b></div>
          <div className="rounded bg-[var(--bg-hover)] p-2">Sheets env: <b>{String(runtime.google_sheets_env)}</b></div>
          <div className="rounded bg-[var(--bg-hover)] p-2">Drive env: <b>{String(runtime.google_drive_env)}</b></div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="font-semibold mb-2">Logs / Auditoría</h2>
        <ul className="space-y-1 text-xs text-[var(--text-muted)] max-h-64 overflow-auto">
          {logs.map((log) => (
            <li key={String(log.id)}>
              {String(log.created_at)} · {String(log.actor)} · {String(log.action)} · {String(log.entity)} — {String(log.detail)}
            </li>
          ))}
          {logs.length === 0 && <li>Sin eventos aún.</li>}
        </ul>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          Respaldos: usa snapshots de Supabase / backups del proyecto. Esta pantalla deja el punto de control operativo.
        </p>
      </section>
    </main>
  );
}
