'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { QcDashboardStats } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import { getQcDashboard, listQcOrganizations } from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

function statusTone(status: string): string {
  if (status === 'aprobada') return 'text-emerald-400';
  if (status === 'rechazada') return 'text-rose-400';
  if (status === 'en_revision') return 'text-amber-400';
  return 'text-orange-300';
}

function barWidth(count: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.max(6, Math.round((count / max) * 100))}%`;
}

export default function QcDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [stats, setStats] = useState<QcDashboardStats | null>(null);
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
        setStats(null);
        return;
      }
      setStoredQcOrgId(active.id);
      setOrgId(active.id);
      const data = await getQcDashboard(active.id, user.id);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando dashboard…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para ver el dashboard QC.
      </div>
    );
  }

  if (!orgId || !stats) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-3 text-sm text-[var(--text-muted)]">
        <p>{error || 'Crea una organización para ver métricas.'}</p>
        <Link href="/m/qc/organizacion" className="text-orange-400 underline">
          Ir a Organización
        </Link>
      </div>
    );
  }

  const maxStatus = Math.max(1, ...stats.surveys_by_status.map((s) => s.count));
  const maxStage = Math.max(1, ...stats.surveys_by_stage.map((s) => s.count));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Dashboard QC</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Resumen de carga, revisión y puntos de atención.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-orange-300"
        >
          Actualizar
        </button>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Proyectos', value: stats.totals.projects, href: '/m/qc/proyectos' },
          { label: 'Clientes', value: stats.totals.clients, href: '/m/qc/clientes' },
          { label: 'Encuestas', value: stats.totals.surveys, href: '/m/qc/encuestas' },
          { label: 'Evidencias', value: stats.totals.evidences, href: '/m/qc/encuestas' },
          { label: 'Reglas activas', value: stats.totals.rules_active, href: '/m/qc/reglas' },
          {
            label: 'Integraciones',
            value: stats.totals.integrations_active,
            href: '/m/qc/integraciones',
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3 hover:border-orange-500/30 transition-colors"
          >
            <p className="text-[11px] text-[var(--text-muted)]">{card.label}</p>
            <p className="text-2xl font-semibold text-[var(--text-primary)] mt-1">{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Por revisar',
            value: stats.attention.pending_review,
            tone: 'text-amber-400',
          },
          {
            label: 'Rechazadas',
            value: stats.attention.rejected,
            tone: 'text-rose-400',
          },
          {
            label: 'Sin GPS (abiertas)',
            value: stats.attention.missing_gps,
            tone: 'text-orange-300',
          },
          {
            label: 'Integraciones en error',
            value: stats.attention.integration_errors,
            tone: 'text-rose-300',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 px-4 py-3"
          >
            <p className="text-[11px] text-[var(--text-muted)]">{item.label}</p>
            <p className={`text-xl font-semibold mt-1 ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Por estado</h2>
          <ul className="space-y-3">
            {stats.surveys_by_status.map((row) => (
              <li key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{row.label}</span>
                  <span className="text-[var(--text-primary)]">{row.count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500/70"
                    style={{ width: barWidth(row.count, maxStatus) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Por etapa actual</h2>
          <ul className="space-y-3">
            {stats.surveys_by_stage.map((row) => (
              <li key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{row.label}</span>
                  <span className="text-[var(--text-primary)]">{row.count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500/60"
                    style={{ width: barWidth(row.count, maxStage) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Por proyecto</h2>
        {stats.projects_breakdown.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Aún no hay proyectos QC.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Proyecto</th>
                  <th className="py-2 px-2 font-medium">Total</th>
                  <th className="py-2 px-2 font-medium">Pend.</th>
                  <th className="py-2 px-2 font-medium">Revisión</th>
                  <th className="py-2 px-2 font-medium">OK</th>
                  <th className="py-2 px-2 font-medium">Rech.</th>
                </tr>
              </thead>
              <tbody>
                {stats.projects_breakdown.map((p) => (
                  <tr key={p.project_id} className="border-b border-[var(--border-subtle)]/60">
                    <td className="py-2.5 pr-3 text-[var(--text-primary)]">{p.project_name}</td>
                    <td className="py-2.5 px-2 text-[var(--text-muted)]">{p.total}</td>
                    <td className="py-2.5 px-2 text-orange-300">{p.pendiente}</td>
                    <td className="py-2.5 px-2 text-amber-400">{p.en_revision}</td>
                    <td className="py-2.5 px-2 text-emerald-400">{p.aprobada}</td>
                    <td className="py-2.5 px-2 text-rose-400">{p.rechazada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Actividad reciente</h2>
          <Link href="/m/qc/encuestas" className="text-[11px] text-orange-400 hover:underline">
            Ver todas
          </Link>
        </div>
        <ul className="space-y-2">
          {stats.recent_surveys.map((s) => (
            <li key={s.id}>
              <Link
                href={`/m/qc/encuestas/${s.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-[var(--border-subtle)] px-3 py-2 hover:border-orange-500/30"
              >
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{s.label}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {s.project_name || 'Sin proyecto'} · etapa {s.current_stage}
                  </p>
                </div>
                <div className="text-[11px] shrink-0">
                  <span className={statusTone(s.status)}>{s.status}</span>
                  <span className="text-[var(--text-muted)]">
                    {' '}
                    · {new Date(s.updated_at).toLocaleString()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {stats.recent_surveys.length === 0 && (
            <li className="text-xs text-[var(--text-muted)]">Sin encuestas todavía.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
