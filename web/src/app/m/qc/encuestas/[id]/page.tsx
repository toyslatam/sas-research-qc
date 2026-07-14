'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  QcEvidence,
  QcEvidenceType,
  QcReviewStageType,
  QcRuleEvaluation,
  QcSurvey,
} from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import {
  createQcEvidence,
  deleteQcEvidence,
  applyQcSurveyRules,
  evaluateQcSurveyRules,
  getQcSurvey,
  listQcEvidences,
  listQcOrganizations,
  submitQcReview,
  uploadQcEvidence,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';

const STAGE_LABELS: Record<QcReviewStageType, string> = {
  ubicacion: 'Ubicación (GPS / dirección)',
  contenido: 'Contenido',
  telefono: 'Teléfono',
};

const EVIDENCE_TYPES: QcEvidenceType[] = ['link', 'photo', 'audio', 'document', 'note'];

function stageBadge(status: string): string {
  if (status === 'aprobada') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'rechazada') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (status === 'observacion') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-white/5 text-[var(--text-muted)] border-[var(--border-subtle)]';
}

function severityClass(severity: string): string {
  if (severity === 'block' || severity === 'error') {
    return 'border-rose-500/30 bg-rose-500/5 text-rose-300';
  }
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/5 text-amber-300';
  return 'border-sky-500/30 bg-sky-500/5 text-sky-300';
}

export default function QcEncuestaDetailPage({ params }: { params: { id: string } }) {
  const surveyId = parseInt(params.id, 10);
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [survey, setSurvey] = useState<QcSurvey | null>(null);
  const [evaluation, setEvaluation] = useState<QcRuleEvaluation | null>(null);
  const [evidences, setEvidences] = useState<QcEvidence[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [evTitle, setEvTitle] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [evNotes, setEvNotes] = useState('');
  const [evType, setEvType] = useState<QcEvidenceType>('link');
  const [evStage, setEvStage] = useState<string>('');
  const [evFile, setEvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !Number.isFinite(surveyId)) {
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
        setSurvey(null);
        setEvaluation(null);
        setEvidences([]);
        return;
      }
      setStoredQcOrgId(active.id);
      setOrgId(active.id);
      const row = await getQcSurvey(active.id, surveyId, user.id);
      setSurvey(row);
      const [evalResult, evRows] = await Promise.all([
        evaluateQcSurveyRules(active.id, surveyId, user.id).catch(() => null),
        listQcEvidences(active.id, surveyId, user.id).catch(() => [] as QcEvidence[]),
      ]);
      setEvaluation(evalResult);
      setEvidences(evRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la encuesta');
    } finally {
      setLoading(false);
    }
  }, [user?.id, surveyId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleApplyRules() {
    if (!user?.id || !orgId) return;
    setActing('apply-rules');
    setError(null);
    try {
      const evalResult = await applyQcSurveyRules(orgId, surveyId, user.id);
      setEvaluation(evalResult);
      if (evalResult.survey) setSurvey(evalResult.survey);
      else {
        const row = await getQcSurvey(orgId, surveyId, user.id);
        setSurvey(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron aplicar las reglas');
    } finally {
      setActing(null);
    }
  }

  async function handleReview(
    stageType: QcReviewStageType,
    status: 'aprobada' | 'rechazada' | 'observacion',
  ) {
    if (!user?.id || !orgId) return;
    setActing(`${stageType}:${status}`);
    setError(null);
    try {
      const updated = await submitQcReview(orgId, surveyId, stageType, {
        status,
        notes: notes[stageType] || '',
        actorUserId: user.id,
      });
      setSurvey(updated);
      const evalResult = await evaluateQcSurveyRules(orgId, surveyId, user.id);
      setEvaluation(evalResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la revisión');
    } finally {
      setActing(null);
    }
  }

  async function handleAddEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !orgId) return;
    setActing('evidence');
    setError(null);
    try {
      if (evFile) {
        await uploadQcEvidence(orgId, surveyId, {
          file: evFile,
          actorUserId: user.id,
          title: evTitle.trim(),
          notes: evNotes.trim(),
          stage_type: evStage || undefined,
          evidence_type: evType,
        });
        setEvFile(null);
      } else {
        await createQcEvidence(orgId, surveyId, {
          evidence_type: evType,
          title: evTitle.trim(),
          url: evUrl.trim(),
          notes: evNotes.trim(),
          stage_type: evStage || null,
          actorUserId: user.id,
        });
      }
      setEvTitle('');
      setEvUrl('');
      setEvNotes('');
      setEvStage('');
      const evRows = await listQcEvidences(orgId, surveyId, user.id);
      setEvidences(evRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar evidencia');
    } finally {
      setActing(null);
    }
  }

  async function handleDeleteEvidence(id: number) {
    if (!user?.id || !orgId) return;
    try {
      await deleteQcEvidence(orgId, id, user.id);
      setEvidences((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando revisión…
      </div>
    );
  }

  if (!user || !orgId || !survey) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-3 text-sm text-[var(--text-muted)]">
        <p>{error || 'Encuesta no disponible.'}</p>
        <Link href="/m/qc/encuestas" className="text-orange-400 underline">
          Volver a encuestas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <Link href="/m/qc/encuestas" className="text-xs text-orange-400 hover:underline">
          ← Encuestas
        </Link>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {survey.external_id || survey.respondent_code || `Encuesta #${survey.id}`}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          {survey.project_name} · estado{' '}
          <span className="text-[var(--text-primary)]">{survey.status}</span> · etapa actual{' '}
          <span className="text-[var(--text-primary)]">{survey.current_stage}</span>
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-2 text-sm">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Datos de campo</h2>
        <p className="text-[var(--text-muted)]">Entrevistador: {survey.interviewer || '—'}</p>
        <p className="text-[var(--text-muted)]">Teléfono: {survey.phone || '—'}</p>
        <p className="text-[var(--text-muted)]">Dirección: {survey.address || '—'}</p>
        <p className="text-[var(--text-muted)]">
          GPS:{' '}
          {survey.latitude != null && survey.longitude != null
            ? `${survey.latitude}, ${survey.longitude}`
            : '—'}
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Evaluación de reglas</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={acting === 'apply-rules'}
              onClick={() => handleApplyRules()}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-orange-500/90 text-white disabled:opacity-50"
            >
              {acting === 'apply-rules' ? 'Aplicando…' : 'Aplicar auto-acciones'}
            </button>
            <Link href="/m/qc/reglas" className="text-[11px] text-orange-400 hover:underline">
              Configurar
            </Link>
          </div>
        </div>
        {!evaluation || evaluation.hits.length === 0 ? (
          <p className="text-xs text-emerald-400/90">Sin hallazgos en reglas activas.</p>
        ) : (
          <ul className="space-y-2">
            {evaluation.hits.map((hit) => (
              <li
                key={`${hit.rule_id}-${hit.field_key}`}
                className={`rounded-xl border px-3 py-2 text-xs ${severityClass(hit.severity)}`}
              >
                <p className="font-medium">
                  [{hit.severity}] {hit.rule_name}
                  <span className="opacity-70 font-normal"> · {hit.action}</span>
                </p>
                <p className="opacity-90 mt-0.5">{hit.message}</p>
              </li>
            ))}
          </ul>
        )}
        {evaluation?.applied_actions && evaluation.applied_actions.length > 0 && (
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
            <p className="text-[11px] text-[var(--text-muted)]">Última aplicación</p>
            {evaluation.applied_actions.map((a, i) => (
              <p key={`${a.rule_id}-${a.stage_type}-${i}`} className="text-[11px] text-[var(--text-muted)]">
                {a.skipped ? 'Omitida' : 'Aplicada'}: {a.rule_name} → {a.stage_type}/{a.status}
                {a.reason ? ` (${a.reason})` : ''}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Evidencias</h2>
        <ul className="space-y-2">
          {evidences.map((ev) => (
            <li
              key={ev.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)]">
                  {ev.title || ev.file_name || ev.evidence_type}
                  <span className="text-[11px] text-[var(--text-muted)]"> · {ev.evidence_type}</span>
                  {ev.file_size != null && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {' '}
                      · {(ev.file_size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </p>
                {ev.url && (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-orange-400 hover:underline break-all"
                  >
                    {ev.file_name || ev.storage_path ? 'Abrir archivo' : ev.url}
                  </a>
                )}
                {ev.notes && <p className="text-[11px] text-[var(--text-muted)]">{ev.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteEvidence(ev.id)}
                className="text-xs px-2 py-1 rounded-lg border border-rose-500/20 text-rose-400/80 shrink-0"
              >
                Eliminar
              </button>
            </li>
          ))}
          {evidences.length === 0 && (
            <li className="text-xs text-[var(--text-muted)]">Sin evidencias aún.</li>
          )}
        </ul>

        <form onSubmit={handleAddEvidence} className="grid sm:grid-cols-2 gap-2">
          <select
            value={evType}
            onChange={(e) => setEvType(e.target.value as QcEvidenceType)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                Tipo: {t}
              </option>
            ))}
          </select>
          <select
            value={evStage}
            onChange={(e) => setEvStage(e.target.value)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Sin etapa</option>
            <option value="ubicacion">Ubicación</option>
            <option value="contenido">Contenido</option>
            <option value="telefono">Teléfono</option>
          </select>
          <input
            value={evTitle}
            onChange={(e) => setEvTitle(e.target.value)}
            placeholder="Título"
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            type="file"
            onChange={(e) => setEvFile(e.target.files?.[0] ?? null)}
            className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] file:mr-2 file:text-xs file:border-0 file:bg-orange-500/20 file:text-orange-300"
          />
          <input
            value={evUrl}
            onChange={(e) => setEvUrl(e.target.value)}
            placeholder={evFile ? 'URL opcional (si subes archivo)' : 'URL / enlace'}
            className="sm:col-span-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <input
            value={evNotes}
            onChange={(e) => setEvNotes(e.target.value)}
            placeholder="Notas"
            className="sm:col-span-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
          />
          <button
            type="submit"
            disabled={acting === 'evidence'}
            className="sm:col-span-2 text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {acting === 'evidence'
              ? 'Guardando…'
              : evFile
                ? 'Subir archivo'
                : 'Agregar evidencia'}
          </button>
        </form>
      </section>

      <div className="space-y-4">
        {(survey.stages ?? []).map((stage) => (
          <section
            key={stage.id}
            className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3 bg-[var(--bg-card)]/20"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                {STAGE_LABELS[stage.stage_type]}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${stageBadge(stage.status)}`}>
                {stage.status}
              </span>
            </div>
            {stage.notes && stage.status !== 'pendiente' && (
              <p className="text-xs text-[var(--text-muted)]">Nota previa: {stage.notes}</p>
            )}
            <textarea
              value={notes[stage.stage_type] ?? ''}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [stage.stage_type]: e.target.value }))
              }
              placeholder="Notas de revisión…"
              rows={2}
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!acting}
                onClick={() => handleReview(stage.stage_type, 'aprobada')}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                {acting === `${stage.stage_type}:aprobada` ? '…' : 'Aprobar'}
              </button>
              <button
                type="button"
                disabled={!!acting}
                onClick={() => handleReview(stage.stage_type, 'observacion')}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 disabled:opacity-50"
              >
                Observación
              </button>
              <button
                type="button"
                disabled={!!acting}
                onClick={() => handleReview(stage.stage_type, 'rechazada')}
                className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-300 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
