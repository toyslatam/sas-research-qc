'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcAuditLog } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import { listQcAuditLogs, listQcOrganizations } from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

export default function QcAuditoriaPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [logs, setLogs] = useState<QcAuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
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
        setLogs([]);
        return;
      }
      setStoredQcOrgId(active.id);
      setOrgId(active.id);
      const rows = await listQcAuditLogs(active.id, user.id, {
        limit: 150,
        action: actionFilter || undefined,
      });
      setLogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando auditoría');
    } finally {
      setLoading(false);
    }
  }, [user?.id, actionFilter]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando auditoría…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para ver la auditoría QC.
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
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Auditoría</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Trazabilidad de acciones QC: revisiones, evidencias y cambios relevantes.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <input
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        placeholder="Filtrar por acción (ej. review, evidence)…"
        className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
      />

      <ul className="space-y-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{log.action}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {log.actor_email || log.actor_id || 'sistema'} · {log.entity_type}
                  {log.entity_id ? ` #${log.entity_id}` : ''}
                  {log.survey_id != null ? ` · encuesta ${log.survey_id}` : ''}
                </p>
                {log.detail && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">{log.detail}</p>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
        {logs.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">
            Sin eventos todavía. Se registran al revisar encuestas o agregar evidencias.
          </li>
        )}
      </ul>
    </div>
  );
}
