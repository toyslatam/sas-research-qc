'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getVoiceMatches,
  listVoiceOrgs,
  listVoiceRecordings,
  reviewVoiceRecording,
  type VoiceMatch,
  type VoiceOrg,
  type VoiceRecording,
} from '@/lib/voiceApi';
import { getStoredVoiceOrgId, setStoredVoiceOrgId } from '@/modules/voice/lib/activeOrg';

const inputClass =
  'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/60 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400';

const DISPO_LABEL: Record<VoiceRecording['disposition'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  duplicate: 'Duplicado',
  rejected: 'Rechazado',
};
const DISPO_COLOR: Record<VoiceRecording['disposition'], string> = {
  pending: 'text-amber-400',
  approved: 'text-emerald-400',
  duplicate: 'text-rose-400',
  rejected: 'text-[var(--text-muted)]',
};
const CONF_COLOR: Record<VoiceMatch['confidence'], string> = {
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-[var(--text-muted)]',
  none: 'text-[var(--text-muted)]',
};

export default function GrabacionesPage() {
  const [orgs, setOrgs] = useState<VoiceOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [role, setRole] = useState<'admin' | 'encuestador' | null>(null);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [matches, setMatches] = useState<VoiceMatch[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const list = await listVoiceOrgs();
      setOrgs(list);
      const stored = getStoredVoiceOrgId();
      const pick = list.find((o) => o.id === stored) ?? list[0];
      if (pick) {
        setOrgId(pick.id);
        setRole(pick.role);
        setStoredVoiceOrgId(pick.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las organizaciones');
    }
  }, []);

  const loadRecordings = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setRecordings(await listVoiceRecordings(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las grabaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (orgId) loadRecordings(orgId);
  }, [orgId, loadRecordings]);

  async function toggleMatches(rec: VoiceRecording) {
    if (openId === rec.id) {
      setOpenId(null);
      return;
    }
    setOpenId(rec.id);
    setMatches([]);
    setMatchesError(null);
    setMatchesLoading(true);
    try {
      const { matches: found } = await getVoiceMatches(orgId, rec.id);
      setMatches(found);
    } catch (e) {
      setMatchesError(e instanceof Error ? e.message : 'No se pudieron cargar las coincidencias');
    } finally {
      setMatchesLoading(false);
    }
  }

  async function setDisposition(rec: VoiceRecording, disposition: VoiceRecording['disposition']) {
    try {
      const updated = await reviewVoiceRecording(orgId, rec.id, disposition);
      setRecordings((rs) => rs.map((r) => (r.id === rec.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dictaminar');
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Grabaciones</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {role === 'admin'
            ? 'Revisa las grabaciones, mira las coincidencias de voz y dictamina.'
            : 'Tus grabaciones subidas.'}
        </p>
      </div>

      {orgs.length > 1 && (
        <select
          value={orgId}
          onChange={(e) => {
            const o = orgs.find((x) => x.id === e.target.value);
            setOrgId(e.target.value);
            setRole(o?.role ?? null);
            setStoredVoiceOrgId(e.target.value);
          }}
          className={inputClass}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.role})
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Cargando…</p>
      ) : recordings.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No hay grabaciones todavía.</p>
      ) : (
        <div className="space-y-2">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-4"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {rec.interview_id}
                    <span className={`ml-3 text-xs font-normal ${DISPO_COLOR[rec.disposition]}`}>
                      {DISPO_LABEL[rec.disposition]}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    #{rec.id} · {rec.surveyor_email ?? 'encuestador desconocido'} ·{' '}
                    {new Date(rec.created_at).toLocaleString()} · huella: {rec.status}
                  </p>
                </div>
                {role === 'admin' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleMatches(rec)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    >
                      {openId === rec.id ? 'Ocultar' : 'Ver coincidencias'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisposition(rec, 'approved')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisposition(rec, 'duplicate')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    >
                      Duplicado
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisposition(rec, 'rejected')}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)]"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>

              {openId === rec.id && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  {matchesLoading ? (
                    <p className="text-xs text-[var(--text-muted)]">Buscando coincidencias…</p>
                  ) : matchesError ? (
                    <p className="text-xs text-rose-400">{matchesError}</p>
                  ) : matches.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Sin otras grabaciones con huella para comparar todavía.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {matches.map((m) => (
                        <li key={`${m.embedding_id}-${m.rank}`} className="flex items-center gap-3 text-xs">
                          <span className="text-[var(--text-muted)] w-5">{m.rank}.</span>
                          <span className="text-[var(--text-primary)] flex-1">
                            Grabación #{m.recording_id ?? '—'}
                          </span>
                          <span className="font-mono text-[var(--text-primary)]">
                            {(m.similarity_score * 100).toFixed(1)}%
                          </span>
                          <span className={`w-16 text-right ${CONF_COLOR[m.confidence]}`}>
                            {m.confidence === 'high'
                              ? 'Alta'
                              : m.confidence === 'medium'
                                ? 'Media'
                                : m.confidence === 'low'
                                  ? 'Baja'
                                  : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-[var(--text-muted)] mt-2">
                    Similitud, no identidad. Es un apoyo para revisión humana.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
