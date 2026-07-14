'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  QcProject,
  QcRule,
  QcRuleAction,
  QcRuleOperator,
  QcRuleSeverity,
  QcRuleStageType,
} from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcRule,
  deleteQcRule,
  listQcOrganizations,
  listQcProjects,
  listQcRules,
  seedQcDefaultRules,
  updateQcRule,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const OPERATORS: QcRuleOperator[] = [
  'required',
  'is_empty',
  'is_not_empty',
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'regex',
  'gt',
  'gte',
  'lt',
  'lte',
  'coords_present',
];

const STAGES: QcRuleStageType[] = ['any', 'ubicacion', 'contenido', 'telefono'];
const SEVERITIES: QcRuleSeverity[] = ['info', 'warning', 'error', 'block'];
const ACTIONS: QcRuleAction[] = ['flag', 'auto_observacion', 'auto_rechazar'];

type Draft = {
  name: string;
  description: string;
  project_id: string;
  stage_type: QcRuleStageType;
  field_key: string;
  operator: QcRuleOperator;
  value_text: string;
  severity: QcRuleSeverity;
  action: QcRuleAction;
  enabled: boolean;
  sort_order: number;
};

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    project_id: '',
    stage_type: 'any',
    field_key: 'phone',
    operator: 'required',
    value_text: '',
    severity: 'warning',
    action: 'flag',
    enabled: true,
    sort_order: 0,
  };
}

export default function QcReglasPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rules, setRules] = useState<QcRule[]>([]);
  const [projects, setProjects] = useState<QcProject[]>([]);
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
        setRules([]);
        setProjects([]);
        return;
      }
      const [ruleRows, projectRows] = await Promise.all([
        listQcRules(id, user.id),
        listQcProjects(id, user.id),
      ]);
      setRules(ruleRows);
      setProjects(projectRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reglas');
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, resolveOrg]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  function startEdit(rule: QcRule) {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      description: rule.description,
      project_id: rule.project_id != null ? String(rule.project_id) : '',
      stage_type: rule.stage_type,
      field_key: rule.field_key,
      operator: rule.operator,
      value_text: rule.value_text,
      severity: rule.severity,
      action: rule.action,
      enabled: rule.enabled,
      sort_order: rule.sort_order,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId || !draft.name.trim() || !draft.field_key.trim()) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      description: draft.description,
      project_id: draft.project_id ? parseInt(draft.project_id, 10) : null,
      stage_type: draft.stage_type,
      field_key: draft.field_key.trim(),
      operator: draft.operator,
      value_text: draft.value_text,
      severity: draft.severity,
      action: draft.action,
      enabled: draft.enabled,
      sort_order: draft.sort_order,
      actorUserId: user.id,
    };
    try {
      if (editingId != null) {
        await updateQcRule(orgId, editingId, payload);
      } else {
        await createQcRule(orgId, payload);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(rule: QcRule) {
    if (!user?.id || !orgId) return;
    try {
      await updateQcRule(orgId, rule.id, {
        enabled: !rule.enabled,
        actorUserId: user.id,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    }
  }

  async function handleDelete(id: number) {
    if (!user?.id || !orgId) return;
    if (!window.confirm('¿Eliminar esta regla?')) return;
    try {
      await deleteQcRule(orgId, id, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  async function handleSeed() {
    if (!user?.id || !orgId) return;
    setSubmitting(true);
    setError(null);
    try {
      await seedQcDefaultRules(orgId, user.id, null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron crear defaults');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando reglas…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar reglas QC.
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
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Motor de reglas</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Validaciones configurables por etapa. Globales o por proyecto QC.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSeed}
          disabled={submitting}
          className="text-xs px-3 py-2 rounded-xl border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 disabled:opacity-50"
        >
          Cargar reglas base
        </button>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {rules.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                  {!r.enabled && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--text-muted)]">
                      off
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)]">{r.severity}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {r.project_name || 'Global'} · {r.stage_type} · {r.field_key} {r.operator}
                  {r.value_text ? ` «${r.value_text}»` : ''} · {r.action}
                </p>
                {r.description && (
                  <p className="text-xs text-[var(--text-muted)]">{r.description}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(r)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)]"
                >
                  {r.enabled ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-orange-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">
            Sin reglas. Usa «Cargar reglas base» o crea una abajo.
          </li>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
      >
        <h2 className="text-sm font-medium text-[var(--text-primary)]">
          {editingId != null ? 'Editar regla' : 'Nueva regla'}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Nombre *"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={draft.project_id}
            onChange={(e) => setDraft((d) => ({ ...d, project_id: e.target.value }))}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Global (toda la org)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={draft.stage_type}
            onChange={(e) =>
              setDraft((d) => ({ ...d, stage_type: e.target.value as QcRuleStageType }))
            }
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                Etapa: {s}
              </option>
            ))}
          </select>
          <input
            required
            value={draft.field_key}
            onChange={(e) => setDraft((d) => ({ ...d, field_key: e.target.value }))}
            placeholder="Campo (phone, address, latitude, answers.x…)"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={draft.operator}
            onChange={(e) =>
              setDraft((d) => ({ ...d, operator: e.target.value as QcRuleOperator }))
            }
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            value={draft.value_text}
            onChange={(e) => setDraft((d) => ({ ...d, value_text: e.target.value }))}
            placeholder="Valor (si aplica)"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <select
            value={draft.severity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, severity: e.target.value as QcRuleSeverity }))
            }
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                Severidad: {s}
              </option>
            ))}
          </select>
          <select
            value={draft.action}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value as QcRuleAction }))}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                Acción: {a}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Mensaje / descripción al fallar"
          rows={2}
          className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
        />
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          Activa
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editingId != null ? 'Guardar' : 'Crear regla'}
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
