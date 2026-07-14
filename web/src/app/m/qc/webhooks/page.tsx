'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QcWebhook, QcWebhookEvent } from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcWebhook,
  deleteQcWebhook,
  listQcOrganizations,
  listQcWebhooks,
  testQcWebhook,
  updateQcWebhook,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const ALL_EVENTS: { id: QcWebhookEvent; label: string }[] = [
  { id: 'rules.applied', label: 'Reglas aplicadas' },
  { id: 'survey.rejected', label: 'Encuesta rechazada' },
  { id: 'survey.observation', label: 'Observación' },
  { id: 'integration.sync', label: 'Sync integración' },
];

export default function QcWebhooksPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<QcWebhook[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<QcWebhookEvent[]>(['rules.applied', 'survey.rejected']);
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
      setItems(await listQcWebhooks(active.id, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando webhooks');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  function toggleEvent(ev: QcWebhookEvent) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !name.trim() || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createQcWebhook(orgId, {
        name: name.trim(),
        url: url.trim(),
        secret: secret.trim(),
        events,
        actorUserId: user.id,
      });
      setName('');
      setUrl('');
      setSecret('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: QcWebhook) {
    if (!user?.id || !orgId) return;
    try {
      const updated = await updateQcWebhook(orgId, item.id, {
        enabled: !item.enabled,
        actorUserId: user.id,
      });
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  async function handleTest(id: number) {
    if (!user?.id || !orgId) return;
    setBusy(true);
    try {
      const updated = await testQcWebhook(orgId, id, user.id);
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test falló');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar este webhook?')) return;
    try {
      await deleteQcWebhook(orgId, id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando webhooks…
      </div>
    );
  }

  if (!user || !orgId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        {!user ? 'Inicia sesión para gestionar webhooks.' : 'Crea primero una organización QC.'}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Webhooks</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Notificaciones HTTP al aplicar reglas auto, rechazar/observar o sincronizar.
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
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3 space-y-2"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{item.name}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      item.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-white/5 text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {item.enabled ? 'activo' : 'pausado'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] break-all">{item.url}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Eventos: {item.events.join(', ') || '—'}
                  {item.last_delivery_at
                    ? ` · último ${new Date(item.last_delivery_at).toLocaleString()} (${item.last_delivery_status}: ${item.last_delivery_message})`
                    : ' · sin entregas'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTest(item.id)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/90 text-white disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)]"
                >
                  {item.enabled ? 'Pausar' : 'Activar'}
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
          <li className="text-xs text-[var(--text-muted)]">Sin webhooks todavía.</li>
        )}
      </ul>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Nuevo webhook</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL HTTPS *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret (firma X-QC-Signature)"
            className="sm:col-span-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => toggleEvent(ev.id)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border ${
                events.includes(ev.id)
                  ? 'border-orange-500/40 text-orange-300 bg-orange-500/10'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              {ev.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={busy || events.length === 0}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
        >
          {busy ? 'Guardando…' : 'Crear webhook'}
        </button>
      </form>
    </div>
  );
}
