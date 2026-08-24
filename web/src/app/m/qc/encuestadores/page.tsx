'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  QcRecruitCandidate,
  QcRecruitContacto,
  QcRecruitEtapa,
  QcRecruitFuente,
  QcRecruitImportRow,
  QcRecruitMunicipio,
  QcRecruitPublicacion,
} from '@whispper/shared';
import { useAuth } from '@/platform/auth/AuthProvider';
import type { QcRecruitGmailMessagePreview, QcRecruitGmailStatus } from '@/lib/api';
import {
  addQcRecruitContactComment,
  changeQcRecruitCandidateStage,
  createQcRecruitCandidate,
  createQcRecruitMunicipio,
  createQcRecruitPublicacion,
  deleteQcRecruitCandidate,
  deleteQcRecruitMunicipio,
  deleteQcRecruitPublicacion,
  disconnectQcRecruitGmail,
  getQcRecruitGmailAuthUrl,
  getQcRecruitGmailStatus,
  importQcRecruitCandidates,
  importQcRecruitGmailRows,
  listQcOrganizations,
  listQcRecruitCandidates,
  listQcRecruitContactos,
  listQcRecruitImportRuns,
  listQcRecruitMunicipios,
  listQcRecruitPublicaciones,
  previewQcRecruitGmail,
  updateQcRecruitMunicipio,
  updateQcRecruitPublicacion,
} from '@/lib/api';
import { getStoredQcOrgId, setStoredQcOrgId } from '@/modules/qc/lib/activeOrg';
import type { ColumnMap } from '@/modules/qc/lib/recruitCsv';
import { COLUMN_FIELDS, autoDetectMapping, buildImportRows, parseCsvTable } from '@/modules/qc/lib/recruitCsv';

const ETAPA_LABEL: Record<QcRecruitEtapa, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  en_activacion: 'En activación',
  activo: 'Activo',
  inactivo: 'Inactivo',
};

const ETAPA_ORDER: QcRecruitEtapa[] = [
  'nuevo',
  'contactado',
  'interesado',
  'en_activacion',
  'activo',
  'inactivo',
];

const ETAPA_COLOR: Record<QcRecruitEtapa, string> = {
  nuevo: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  contactado: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  interesado: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  en_activacion: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  activo: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  inactivo: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

const FUENTE_LABEL: Record<QcRecruitFuente, string> = {
  indeed: 'Indeed',
  computrabajo: 'Computrabajo',
  referido: 'Referido',
  otro: 'Otro',
};

const inputClass =
  'rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-orange-500/40';

type Tab = 'candidatos' | 'kanban' | 'municipios' | 'publicaciones' | 'importar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'candidatos', label: 'Candidatos' },
  { id: 'kanban', label: 'Control individual' },
  { id: 'municipios', label: 'Municipios' },
  { id: 'publicaciones', label: 'Publicaciones' },
  { id: 'importar', label: 'Importar' },
];

export default function QcEncuestadoresPage() {
  const { user, loading: authLoading } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('candidatos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<QcRecruitCandidate[]>([]);
  const [municipios, setMunicipios] = useState<QcRecruitMunicipio[]>([]);
  const [publicaciones, setPublicaciones] = useState<QcRecruitPublicacion[]>([]);

  const [search, setSearch] = useState('');
  const [etapaFilter, setEtapaFilter] = useState<QcRecruitEtapa | ''>('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  const resolveOrg = useCallback(async () => {
    if (!user?.id) return null;
    const orgs = await listQcOrganizations(user.id);
    const stored = getStoredQcOrgId();
    const active = orgs.find((o) => o.id === stored) ?? orgs[0] ?? null;
    if (active) setStoredQcOrgId(active.id);
    setOrgId(active?.id ?? null);
    return active?.id ?? null;
  }, [user?.id]);

  const loadCandidates = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      const rows = await listQcRecruitCandidates(id, user.id, {
        search: search || undefined,
        etapa: etapaFilter || undefined,
      });
      setCandidates(rows);
    },
    [user?.id, search, etapaFilter],
  );

  const loadAll = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const id = orgId ?? (await resolveOrg());
      if (!id) return;
      const [muniRows, pubRows] = await Promise.all([
        listQcRecruitMunicipios(id, user.id),
        listQcRecruitPublicaciones(id, user.id),
      ]);
      setMunicipios(muniRows);
      setPublicaciones(pubRows);
      await loadCandidates(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reclutamiento');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, resolveOrg]);

  useEffect(() => {
    if (!authLoading) loadAll();
  }, [authLoading, loadAll]);

  useEffect(() => {
    if (orgId) loadCandidates(orgId).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, etapaFilter, orgId]);

  const municipioById = useMemo(() => {
    const map = new Map<number, QcRecruitMunicipio>();
    for (const m of municipios) map.set(m.id, m);
    return map;
  }, [municipios]);

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Cargando Seguimiento Encuestadores…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Inicia sesión para gestionar reclutamiento.
      </div>
    );
  }
  if (!orgId) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-[var(--text-muted)]">
        Primero crea una organización en{' '}
        <a href="/m/qc/organizacion" className="text-orange-400 underline">
          Organización
        </a>
        .
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Seguimiento Encuestadores</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Reclutamiento de encuestadores de campo por municipio.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-400 border border-rose-500/20 rounded-xl px-3 py-2 bg-rose-500/5">
          {error}
        </p>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-[var(--border-subtle)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'text-orange-400 border-orange-400'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'candidatos' && (
        <CandidatosTab
          orgId={orgId}
          actorUserId={user.id}
          candidates={candidates}
          municipios={municipios}
          search={search}
          setSearch={setSearch}
          etapaFilter={etapaFilter}
          setEtapaFilter={setEtapaFilter}
          onSelect={setSelectedCandidateId}
          reload={() => loadCandidates(orgId)}
        />
      )}

      {tab === 'kanban' && (
        <KanbanTab candidates={candidates} municipioById={municipioById} onSelect={setSelectedCandidateId} />
      )}

      {tab === 'municipios' && (
        <MunicipiosTab
          orgId={orgId}
          actorUserId={user.id}
          municipios={municipios}
          reload={async () => setMunicipios(await listQcRecruitMunicipios(orgId, user.id))}
        />
      )}

      {tab === 'publicaciones' && (
        <PublicacionesTab
          orgId={orgId}
          actorUserId={user.id}
          publicaciones={publicaciones}
          municipios={municipios}
          reload={async () => setPublicaciones(await listQcRecruitPublicaciones(orgId, user.id))}
        />
      )}

      {tab === 'importar' && <ImportarTab orgId={orgId} actorUserId={user.id} onImported={loadAll} />}

      {selectedCandidateId != null && (
        <CandidateDetailPanel
          orgId={orgId}
          actorUserId={user.id}
          candidateId={selectedCandidateId}
          candidate={candidates.find((c) => c.id === selectedCandidateId) ?? null}
          onClose={() => setSelectedCandidateId(null)}
          onChanged={() => orgId && loadCandidates(orgId)}
        />
      )}
    </div>
  );
}

// ── Candidatos ───────────────────────────────────────────────────────────

function CandidatosTab({
  orgId,
  actorUserId,
  candidates,
  municipios,
  search,
  setSearch,
  etapaFilter,
  setEtapaFilter,
  onSelect,
  reload,
}: {
  orgId: string;
  actorUserId: string;
  candidates: QcRecruitCandidate[];
  municipios: QcRecruitMunicipio[];
  search: string;
  setSearch: (v: string) => void;
  etapaFilter: QcRecruitEtapa | '';
  setEtapaFilter: (v: QcRecruitEtapa | '') => void;
  onSelect: (id: number) => void;
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    nombre: '',
    celular: '',
    email: '',
    municipio_id: '' as number | '',
    fuente: 'otro' as QcRecruitFuente,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.nombre.trim() || !draft.celular.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createQcRecruitCandidate(orgId, {
        nombre: draft.nombre.trim(),
        celular: draft.celular.trim(),
        email: draft.email.trim() || undefined,
        municipio_id: draft.municipio_id === '' ? null : draft.municipio_id,
        fuente: draft.fuente,
        actorUserId,
      });
      setDraft({ nombre: '', celular: '', email: '', municipio_id: '', fuente: 'otro' });
      setShowForm(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el candidato');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este candidato? Se borra también su historial de contacto.')) return;
    await deleteQcRecruitCandidate(orgId, id, actorUserId);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, celular o email…"
          className={`${inputClass} flex-1 min-w-[200px]`}
        />
        <select
          value={etapaFilter}
          onChange={(e) => setEtapaFilter(e.target.value as QcRecruitEtapa | '')}
          className={inputClass}
        >
          <option value="">Todas las etapas</option>
          {ETAPA_ORDER.map((et) => (
            <option key={et} value={et}>
              {ETAPA_LABEL[et]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium"
        >
          {showForm ? 'Cancelar' : 'Nuevo candidato'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
        >
          {formError && <p className="text-sm text-rose-400">{formError}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              placeholder="Nombre *"
              className={inputClass}
            />
            <input
              required
              value={draft.celular}
              onChange={(e) => setDraft((d) => ({ ...d, celular: e.target.value }))}
              placeholder="Celular *"
              className={inputClass}
            />
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              placeholder="Email"
              className={inputClass}
            />
            <select
              value={draft.municipio_id}
              onChange={(e) =>
                setDraft((d) => ({ ...d, municipio_id: e.target.value ? Number(e.target.value) : '' }))
              }
              className={inputClass}
            >
              <option value="">Municipio…</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <select
              value={draft.fuente}
              onChange={(e) => setDraft((d) => ({ ...d, fuente: e.target.value as QcRecruitFuente }))}
              className={inputClass}
            >
              {(Object.keys(FUENTE_LABEL) as QcRecruitFuente[]).map((f) => (
                <option key={f} value={f}>
                  {FUENTE_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Crear candidato'}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-3 cursor-pointer hover:border-orange-500/30"
            onClick={() => onSelect(c.id)}
          >
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{c.nombre}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {c.celular}
                {c.municipio_nombre ? ` · ${c.municipio_nombre}` : ''} · {FUENTE_LABEL[c.fuente]}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${ETAPA_COLOR[c.etapa]}`}>
                {ETAPA_LABEL[c.etapa]}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(c.id);
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        {candidates.length === 0 && (
          <li className="text-xs text-[var(--text-muted)]">Sin candidatos todavía.</li>
        )}
      </ul>
    </div>
  );
}

// ── Control individual (kanban) ─────────────────────────────────────────────

function KanbanTab({
  candidates,
  municipioById,
  onSelect,
}: {
  candidates: QcRecruitCandidate[];
  municipioById: Map<number, QcRecruitMunicipio>;
  onSelect: (id: number) => void;
}) {
  const columns: QcRecruitEtapa[] = ['interesado', 'en_activacion', 'activo'];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {columns.map((col) => {
        const items = candidates.filter((c) => c.etapa === col);
        return (
          <div key={col} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{ETAPA_LABEL[col]}</h3>
              <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-full px-2 py-0.5">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5 hover:border-orange-500/30"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{c.nombre}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {c.municipio_nombre ?? municipioById.get(c.municipio_id ?? -1)?.nombre ?? 'Sin municipio'}
                  </p>
                </button>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] px-1 py-2">Sin candidatos</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Detalle de candidato: cambio de etapa + conversación ───────────────────

function CandidateDetailPanel({
  orgId,
  actorUserId,
  candidateId,
  candidate,
  onClose,
  onChanged,
}: {
  orgId: string;
  actorUserId: string;
  candidateId: number;
  candidate: QcRecruitCandidate | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [contactos, setContactos] = useState<QcRecruitContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [etapa, setEtapa] = useState<QcRecruitEtapa>(candidate?.etapa ?? 'nuevo');
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContactos(await listQcRecruitContactos(orgId, candidateId, actorUserId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando historial');
    } finally {
      setLoading(false);
    }
  }, [orgId, candidateId, actorUserId]);

  useEffect(() => {
    load();
    setEtapa(candidate?.etapa ?? 'nuevo');
  }, [load, candidate?.etapa]);

  async function handleSaveStage() {
    setSubmitting(true);
    setError(null);
    try {
      await changeQcRecruitCandidateStage(orgId, candidateId, {
        etapa,
        comentario: comentario.trim() || undefined,
        actorUserId,
      });
      setComentario('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddComment() {
    if (!comentario.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addQcRecruitContactComment(orgId, candidateId, { comentario: comentario.trim(), actorUserId });
      setComentario('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el comentario');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {candidate?.nombre ?? 'Candidato'}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {candidate?.celular} {candidate?.municipio_nombre ? `· ${candidate.municipio_nombre}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm">
            Cerrar
          </button>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--text-muted)]">Etapa</label>
          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value as QcRecruitEtapa)}
            className={`${inputClass} w-full`}
          >
            {ETAPA_ORDER.map((et) => (
              <option key={et} value={et}>
                {ETAPA_LABEL[et]}
              </option>
            ))}
          </select>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentario de esta gestión (llamada, WhatsApp, etc.)…"
            rows={2}
            className={`${inputClass} w-full`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveStage}
              disabled={submitting}
              className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : 'Guardar etapa'}
            </button>
            <button
              type="button"
              onClick={handleAddComment}
              disabled={submitting || !comentario.trim()}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] disabled:opacity-50"
            >
              Solo comentar
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Conversación
          </h3>
          {loading ? (
            <p className="text-xs text-[var(--text-muted)]">Cargando…</p>
          ) : contactos.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Sin contactos registrados todavía.</p>
          ) : (
            <ul className="space-y-2">
              {contactos.map((ct) => (
                <li key={ct.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/40 px-3 py-2">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>
                      {ct.etapa_anterior && ct.etapa_nueva && ct.etapa_anterior !== ct.etapa_nueva
                        ? `${ETAPA_LABEL[ct.etapa_anterior]} → ${ETAPA_LABEL[ct.etapa_nueva]}`
                        : ct.etapa_nueva
                          ? ETAPA_LABEL[ct.etapa_nueva]
                          : 'Comentario'}
                    </span>
                    <span>{new Date(ct.created_at).toLocaleString('es-CO')}</span>
                  </div>
                  {ct.comentario && (
                    <p className="text-sm text-[var(--text-primary)] mt-1">{ct.comentario}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Municipios ───────────────────────────────────────────────────────────

function MunicipiosTab({
  orgId,
  actorUserId,
  municipios,
  reload,
}: {
  orgId: string;
  actorUserId: string;
  municipios: QcRecruitMunicipio[];
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    nombre: '',
    departamento: '',
    zona: '',
    prioridad: 'media' as 'alta' | 'media' | 'baja',
    meta: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(m: QcRecruitMunicipio) {
    setEditingId(m.id);
    setDraft({ nombre: m.nombre, departamento: m.departamento, zona: m.zona, prioridad: m.prioridad, meta: m.meta });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setDraft({ nombre: '', departamento: '', zona: '', prioridad: 'media', meta: 0 });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.nombre.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId != null) {
        await updateQcRecruitMunicipio(orgId, editingId, { ...draft, actorUserId });
      } else {
        await createQcRecruitMunicipio(orgId, { ...draft, actorUserId });
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este municipio?')) return;
    await deleteQcRecruitMunicipio(orgId, id, actorUserId);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium"
        >
          {showForm ? 'Cancelar' : 'Nuevo municipio'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20"
        >
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              placeholder="Municipio *"
              className={inputClass}
            />
            <input
              value={draft.departamento}
              onChange={(e) => setDraft((d) => ({ ...d, departamento: e.target.value }))}
              placeholder="Departamento"
              className={inputClass}
            />
            <input
              value={draft.zona}
              onChange={(e) => setDraft((d) => ({ ...d, zona: e.target.value }))}
              placeholder="Zona"
              className={inputClass}
            />
            <select
              value={draft.prioridad}
              onChange={(e) => setDraft((d) => ({ ...d, prioridad: e.target.value as 'alta' | 'media' | 'baja' }))}
              className={inputClass}
            >
              <option value="alta">Prioridad alta</option>
              <option value="media">Prioridad media</option>
              <option value="baja">Prioridad baja</option>
            </select>
            <input
              type="number"
              min={0}
              value={draft.meta}
              onChange={(e) => setDraft((d) => ({ ...d, meta: Number(e.target.value) }))}
              placeholder="Meta de encuestadores"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editingId != null ? 'Guardar' : 'Crear'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {municipios.map((m) => {
          const cobertura = m.meta > 0 ? Math.round(((m.activos_count ?? 0) / m.meta) * 100) : 0;
          return (
            <div key={m.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{m.nombre}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{m.departamento || m.zona || '—'}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    m.prioridad === 'alta'
                      ? 'text-rose-400'
                      : m.prioridad === 'media'
                        ? 'text-amber-400'
                        : 'text-[var(--text-muted)]'
                  }`}
                >
                  {m.prioridad}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                <span>Meta {m.meta}</span>
                <span>Activos {m.activos_count ?? 0}</span>
                <span>Cobertura {cobertura}%</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => startEdit(m)} className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-orange-300">
                  Editar
                </button>
                <button type="button" onClick={() => handleDelete(m.id)} className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-400/80">
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
        {municipios.length === 0 && <p className="text-xs text-[var(--text-muted)]">Sin municipios todavía.</p>}
      </div>
    </div>
  );
}

// ── Publicaciones ────────────────────────────────────────────────────────

function PublicacionesTab({
  orgId,
  actorUserId,
  publicaciones,
  municipios,
  reload,
}: {
  orgId: string;
  actorUserId: string;
  publicaciones: QcRecruitPublicacion[];
  municipios: QcRecruitMunicipio[];
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    titulo: '',
    portal: 'indeed' as 'indeed' | 'computrabajo' | 'otro',
    municipio_id: '' as number | '',
    fecha_publicacion: '',
    vistas: 0,
    postulaciones: 0,
    estado: 'activa' as 'activa' | 'pausada' | 'cerrada',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(p: QcRecruitPublicacion) {
    setEditingId(p.id);
    setDraft({
      titulo: p.titulo,
      portal: p.portal,
      municipio_id: p.municipio_id ?? '',
      fecha_publicacion: p.fecha_publicacion ?? '',
      vistas: p.vistas,
      postulaciones: p.postulaciones,
      estado: p.estado,
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setDraft({ titulo: '', portal: 'indeed', municipio_id: '', fecha_publicacion: '', vistas: 0, postulaciones: 0, estado: 'activa' });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.titulo.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        titulo: draft.titulo.trim(),
        portal: draft.portal,
        municipio_id: draft.municipio_id === '' ? null : draft.municipio_id,
        fecha_publicacion: draft.fecha_publicacion || null,
        vistas: draft.vistas,
        postulaciones: draft.postulaciones,
        estado: draft.estado,
        actorUserId,
      };
      if (editingId != null) {
        await updateQcRecruitPublicacion(orgId, editingId, payload);
      } else {
        await createQcRecruitPublicacion(orgId, payload);
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta publicación?')) return;
    await deleteQcRecruitPublicacion(orgId, id, actorUserId);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium"
        >
          {showForm ? 'Cancelar' : 'Nueva publicación'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--border-subtle)] p-5 bg-[var(--bg-card)]/20">
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              value={draft.titulo}
              onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
              placeholder="Título de la publicación *"
              className={`${inputClass} sm:col-span-2`}
            />
            <select value={draft.portal} onChange={(e) => setDraft((d) => ({ ...d, portal: e.target.value as 'indeed' | 'computrabajo' | 'otro' }))} className={inputClass}>
              <option value="indeed">Indeed</option>
              <option value="computrabajo">Computrabajo</option>
              <option value="otro">Otro</option>
            </select>
            <select
              value={draft.municipio_id}
              onChange={(e) => setDraft((d) => ({ ...d, municipio_id: e.target.value ? Number(e.target.value) : '' }))}
              className={inputClass}
            >
              <option value="">Municipio…</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.fecha_publicacion}
              onChange={(e) => setDraft((d) => ({ ...d, fecha_publicacion: e.target.value }))}
              className={inputClass}
            />
            <select value={draft.estado} onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value as 'activa' | 'pausada' | 'cerrada' }))} className={inputClass}>
              <option value="activa">Activa</option>
              <option value="pausada">Pausada</option>
              <option value="cerrada">Cerrada</option>
            </select>
            <input
              type="number"
              min={0}
              value={draft.vistas}
              onChange={(e) => setDraft((d) => ({ ...d, vistas: Number(e.target.value) }))}
              placeholder="Vistas"
              className={inputClass}
            />
            <input
              type="number"
              min={0}
              value={draft.postulaciones}
              onChange={(e) => setDraft((d) => ({ ...d, postulaciones: Number(e.target.value) }))}
              placeholder="Postulaciones"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={submitting} className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50">
            {submitting ? 'Guardando…' : editingId != null ? 'Guardar' : 'Crear'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
              <th className="px-4 py-2.5">Publicación</th>
              <th className="px-4 py-2.5">Portal</th>
              <th className="px-4 py-2.5">Municipio</th>
              <th className="px-4 py-2.5">Vistas</th>
              <th className="px-4 py-2.5">Postulaciones</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {publicaciones.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{p.titulo}</td>
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.portal}</td>
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.municipio_nombre ?? '—'}</td>
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.vistas}</td>
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.postulaciones}</td>
                <td className="px-4 py-2.5 text-[var(--text-muted)]">{p.estado}</td>
                <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                  <button type="button" onClick={() => startEdit(p)} className="text-xs text-[var(--text-muted)] hover:text-orange-300">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(p.id)} className="text-xs text-rose-400/80">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {publicaciones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-xs text-[var(--text-muted)] text-center">
                  Sin publicaciones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Importar (automatización de sourcing) ───────────────────────────────────


function ImportarTab({
  orgId,
  actorUserId,
  onImported,
}: {
  orgId: string;
  actorUserId: string;
  onImported: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [source, setSource] = useState<'csv' | 'gmail'>('csv');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listQcRecruitImportRuns>>>([]);

  const table = useMemo(() => parseCsvTable(csvText), [csvText]);
  const autoMap = useMemo(() => autoDetectMapping(table.headers), [table.headers]);
  // Lo que el usuario corrige a mano gana sobre la detección automática, pero se
  // descarta si pega otro archivo (los índices de columna ya no significan lo mismo).
  const [mapOverride, setMapOverride] = useState<Partial<ColumnMap>>({});
  const headerKey = table.headers.join('|');
  useEffect(() => {
    setMapOverride({});
  }, [headerKey]);

  const colMap = useMemo<ColumnMap>(() => ({ ...autoMap, ...mapOverride }), [autoMap, mapOverride]);
  const rows = useMemo(() => buildImportRows(table, colMap), [table, colMap]);
  const validRows = useMemo(() => rows.filter((r) => r.nombre && r.celular), [rows]);
  const invalidCount = rows.length - validRows.length;

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await listQcRecruitImportRuns(orgId, actorUserId));
    } catch {
      setRuns([]);
    }
  }, [orgId, actorUserId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Al volver del consentimiento de Google, index.ts redirige aquí con
  // ?tab=importar&gmail=connected|error — lo leemos una vez y limpiamos la URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get('gmail');
    if (!gmailStatus) return;
    setSource('gmail');
    if (gmailStatus === 'connected') {
      setResult('Cuenta de Gmail conectada.');
    } else if (gmailStatus === 'error') {
      setError(`No se pudo conectar Gmail (${params.get('reason') ?? 'error desconocido'})`);
    }
    params.delete('gmail');
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);

  async function handleImport() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      // Solo se mandan las filas completas: las incompletas ya se le muestran al
      // usuario antes de importar, no tiene sentido gastarlas como errores del run.
      const run = await importQcRecruitCandidates(orgId, { rows: validRows, source, actorUserId });
      setResult(`${run.created_count} nuevos · ${run.duplicate_count} duplicados · ${run.error_count} errores`);
      setCsvText('');
      await loadRuns();
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={source} onChange={(e) => setSource(e.target.value as 'csv' | 'gmail')} className={inputClass}>
          <option value="gmail">Fuente: Gmail</option>
          <option value="csv">Fuente: CSV / export manual</option>
        </select>
      </div>

      {source === 'gmail' ? (
        <GmailImportPanel
          orgId={orgId}
          actorUserId={actorUserId}
          onImported={async () => {
            await loadRuns();
            onImported();
          }}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Importar candidatos (CSV)</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Pega el CSV tal como lo exporta Indeed/Computrabajo — no hace falta renombrar columnas.
              Los duplicados se detectan por celular y no se sobrescriben; los nuevos entran en etapa <strong>Nuevo</strong>.
            </p>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Name,Phone,Email,Location\nJuan Pérez,+57 300 123 4567,juan@mail.com,"Medellín, Antioquia"'}
            rows={6}
            className={`${inputClass} w-full font-mono text-xs`}
          />

          {table.headers.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/40 p-3">
              <p className="text-xs text-[var(--text-muted)]">
                Se detectaron {table.headers.length} columnas. Revisa el mapeo antes de importar:
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {COLUMN_FIELDS.map((f) => (
                  <label key={f.id} className="text-xs space-y-1">
                    <span className="text-[var(--text-muted)]">
                      {f.label}
                      {f.required && <span className="text-rose-400"> *</span>}
                    </span>
                    <select
                      value={colMap[f.id] ?? ''}
                      onChange={(e) =>
                        setMapOverride((m) => ({
                          ...m,
                          [f.id]: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                      className={`${inputClass} w-full text-xs`}
                    >
                      <option value="">— ninguna —</option>
                      {table.headers.map((h, i) => (
                        <option key={`${h}-${i}`} value={i}>
                          {h || `(columna ${i + 1})`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {validRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--text-muted)] text-left">
                        <th className="py-1 pr-3 font-normal">Nombre</th>
                        <th className="py-1 pr-3 font-normal">Celular</th>
                        <th className="py-1 pr-3 font-normal">Email</th>
                        <th className="py-1 font-normal">Municipio</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text-primary)]">
                      {validRows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-t border-[var(--border-subtle)]">
                          <td className="py-1 pr-3">{r.nombre}</td>
                          <td className="py-1 pr-3 font-mono">{r.celular}</td>
                          <td className="py-1 pr-3">{r.email ?? '—'}</td>
                          <td className="py-1">{r.municipio ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[var(--text-muted)]">
              {validRows.length} listas para importar
              {invalidCount > 0 && (
                <span className="text-amber-400"> · {invalidCount} sin nombre o celular (se omiten)</span>
              )}
            </span>
            <button
              type="button"
              onClick={handleImport}
              disabled={submitting || validRows.length === 0}
              className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Importando…' : `Importar ${validRows.length}`}
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-sm text-emerald-400">{result}</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Historial de importaciones
        </h3>
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/30 px-4 py-2.5 text-sm">
              <span className="text-[var(--text-primary)]">
                {r.created_count} nuevos · {r.duplicate_count} duplicados · {r.error_count} errores
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {r.source} · {new Date(r.created_at).toLocaleString('es-CO')}
              </span>
            </li>
          ))}
          {runs.length === 0 && <li className="text-xs text-[var(--text-muted)]">Sin importaciones todavía.</li>}
        </ul>
      </div>
    </div>
  );
}

// ── Gmail: conectar, previsualizar (solo lectura) e importar ───────────────

function GmailImportPanel({
  orgId,
  actorUserId,
  onImported,
}: {
  orgId: string;
  actorUserId: string;
  onImported: () => Promise<void>;
}) {
  const [status, setStatus] = useState<QcRecruitGmailStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<QcRecruitGmailMessagePreview[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { nombre: string; celular: string; email: string; municipio: string }>
  >({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await getQcRecruitGmailStatus(orgId, actorUserId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el estado de Gmail');
    } finally {
      setLoadingStatus(false);
    }
  }, [orgId, actorUserId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getQcRecruitGmailAuthUrl(orgId, actorUserId);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la conexión con Google');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('¿Desconectar esta cuenta de Gmail? Podrás volver a conectarla cuando quieras.')) return;
    try {
      await disconnectQcRecruitGmail(orgId, actorUserId);
      setMessages([]);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desconectar');
    }
  }

  async function handleSearch() {
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const { messages: found } = await previewQcRecruitGmail(orgId, actorUserId);
      setMessages(found);
      const nextDrafts: typeof drafts = {};
      const nextSelected: typeof selected = {};
      for (const m of found) {
        nextDrafts[m.id] = { ...m.suggested };
        nextSelected[m.id] = Boolean(m.suggested.nombre && m.suggested.celular);
      }
      setDrafts(nextDrafts);
      setSelected(nextSelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los correos');
    } finally {
      setSearching(false);
    }
  }

  async function handleImportSelected() {
    const rows: QcRecruitImportRow[] = messages
      .filter((m) => selected[m.id])
      .map((m) => ({
        nombre: drafts[m.id]?.nombre.trim() ?? '',
        celular: drafts[m.id]?.celular.trim() ?? '',
        email: drafts[m.id]?.email.trim() || undefined,
        municipio: drafts[m.id]?.municipio.trim() || undefined,
        fuente: (/computrabajo/i.test(m.from) ? 'computrabajo' : 'indeed') as QcRecruitFuente,
      }))
      .filter((r) => r.nombre && r.celular);
    if (rows.length === 0) {
      setError('Selecciona al menos un correo con nombre y celular completos');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const run = await importQcRecruitGmailRows(orgId, { rows, actorUserId });
      setResult(`${run.created_count} nuevos · ${run.duplicate_count} duplicados · ${run.error_count} errores`);
      setMessages([]);
      await onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setImporting(false);
    }
  }

  if (loadingStatus) {
    return <p className="text-sm text-[var(--text-muted)]">Consultando conexión con Gmail…</p>;
  }

  if (!status?.connected) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Conectar Gmail</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Solo lectura: leemos las notificaciones de Indeed/Computrabajo para sugerir candidatos. No enviamos,
          borramos ni modificamos ningún correo.
        </p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
        >
          {connecting ? 'Redirigiendo…' : 'Conectar con Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Conectado como {status.email}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Solo lectura · últimos 60 días</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {searching ? 'Buscando…' : 'Buscar correos nuevos'}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs px-3 py-2 rounded-xl border border-rose-500/20 text-rose-400/80"
          >
            Desconectar
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {messages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            Revisa y corrige antes de importar — la extracción es automática y puede fallar.
          </p>
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/40 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[m.id])}
                    onChange={(e) => setSelected((s) => ({ ...s, [m.id]: e.target.checked }))}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-[var(--text-muted)] truncate flex-1">
                        {m.subject || '(sin asunto)'} · {m.from}
                      </p>
                      {m.cvUrl && (
                        <a
                          href={m.cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300 whitespace-nowrap shrink-0"
                        >
                          Ver CV en Indeed ↗
                        </a>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-4 gap-2 mt-2">
                      <input
                        value={drafts[m.id]?.nombre ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], nombre: e.target.value } }))}
                        placeholder="Nombre"
                        className={`${inputClass} text-xs`}
                      />
                      <input
                        value={drafts[m.id]?.celular ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], celular: e.target.value } }))}
                        placeholder="Celular"
                        className={`${inputClass} text-xs`}
                      />
                      <input
                        value={drafts[m.id]?.email ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], email: e.target.value } }))}
                        placeholder="Email"
                        className={`${inputClass} text-xs`}
                      />
                      <input
                        value={drafts[m.id]?.municipio ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], municipio: e.target.value } }))}
                        placeholder="Municipio"
                        className={`${inputClass} text-xs`}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleImportSelected}
            disabled={importing}
            className="text-sm px-4 py-2 rounded-xl bg-orange-500/90 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {importing ? 'Importando…' : `Importar seleccionados (${Object.values(selected).filter(Boolean).length})`}
          </button>
        </div>
      )}

      {result && <p className="text-sm text-emerald-400">{result}</p>}
      {messages.length === 0 && !searching && (
        <p className="text-xs text-[var(--text-muted)]">
          Pulsa "Buscar correos nuevos" para revisar las últimas notificaciones de Indeed/Computrabajo.
        </p>
      )}
    </div>
  );
}
