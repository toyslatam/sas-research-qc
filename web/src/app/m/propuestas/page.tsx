'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ManagedProject, ModuleProposal, ModuleProposalStatus } from '@whispper/shared';
import {
  addModuleProposalVersion,
  compareModuleProposalVersions,
  createModuleProposal,
  deleteModuleProposal,
  exportModuleProposalPdfUrl,
  getModuleProposal,
  listManagedProjects,
  listModuleProposals,
  saveModuleProposalToDrive,
  shareModuleProposal,
} from '@/lib/api';

const STATUS: ModuleProposalStatus[] = ['borrador', 'enviada', 'en_revision', 'aprobada', 'rechazada'];

export default function PropuestasModulePage() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [proposals, setProposals] = useState<ModuleProposal[]>([]);
  const [selected, setSelected] = useState<ModuleProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [notes, setNotes] = useState('');
  const [compareA, setCompareA] = useState(1);
  const [compareB, setCompareB] = useState(1);
  const [compareResult, setCompareResult] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, rows] = await Promise.all([
        listManagedProjects({}),
        listModuleProposals(projectId ?? undefined),
      ]);
      setProjects(p);
      if (!projectId && p.length) setProjectId(p[0].id);
      setProposals(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando propuestas');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !title.trim()) {
      setError('Proyecto y título son requeridos');
      return;
    }
    try {
      await createModuleProposal({
        managed_project_id: projectId,
        title,
        client,
        file_name: fileName,
        file_content: fileContent,
        notes,
      });
      setTitle('');
      setClient('');
      setFileName('');
      setFileContent('');
      setNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  async function openProposal(id: number) {
    try {
      const full = await getModuleProposal(id);
      setSelected(full);
      setCompareA(1);
      setCompareB(full.current_version);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir');
    }
  }

  async function addVersion() {
    if (!selected) return;
    try {
      const updated = await addModuleProposalVersion(selected.id, {
        file_name: fileName || `v${selected.current_version + 1}.txt`,
        file_content: fileContent,
        notes,
        client: client || selected.client,
      });
      setSelected(updated);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo versionar');
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Módulo</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Propuestas</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Versiones, historial, comparación, exportar PDF, compartir y Google Drive.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <select
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
          className="w-full md:w-80 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm"
        >
          <option value="">Selecciona proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm" />
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Cliente" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm" />
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Nombre archivo" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm" />
          <textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} placeholder="Contenido / texto de la propuesta" rows={3} className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm" />
          <button type="submit" className="md:col-span-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium">
            Crear propuesta
          </button>
        </form>
      </section>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">{error}</div>}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">Listado</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
          ) : (
            proposals.map((p) => (
              <article key={p.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{p.title}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{p.client || 'Sin cliente'} · v{p.current_version} · {p.status}</p>
                  </div>
                  <button type="button" onClick={() => openProposal(p.id)} className="text-xs text-amber-400 hover:text-amber-300">Abrir</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={exportModuleProposalPdfUrl(p.id)} className="px-2 py-1 rounded border border-[var(--border-subtle)] text-xs">PDF</a>
                  <button type="button" className="px-2 py-1 rounded border border-[var(--border-subtle)] text-xs" onClick={async () => {
                    const s = await shareModuleProposal(p.id);
                    await navigator.clipboard.writeText(s.share_url);
                    alert(`Enlace copiado:\n${s.share_url}`);
                  }}>Compartir</button>
                  <button type="button" className="px-2 py-1 rounded border border-[var(--border-subtle)] text-xs" onClick={async () => {
                    try {
                      const d = await saveModuleProposalToDrive(p.id);
                      alert(`Guardado en Drive: ${d.drive_file_id}`);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Drive no disponible');
                    }
                  }}>Drive</button>
                  <button type="button" className="px-2 py-1 rounded border border-rose-500/30 text-xs text-rose-300" onClick={async () => {
                    await deleteModuleProposal(p.id);
                    await load();
                    if (selected?.id === p.id) setSelected(null);
                  }}>Eliminar</button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
          <h2 className="font-semibold text-[var(--text-primary)]">Detalle / versiones</h2>
          {!selected ? (
            <p className="text-sm text-[var(--text-muted)]">Selecciona una propuesta.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-primary)]">{selected.title} · v{selected.current_version}</p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {STATUS.map((s) => (
                  <span key={s} className={`px-2 py-1 rounded-full border ${selected.status === s ? 'border-amber-500/40 text-amber-300' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}>{s}</span>
                ))}
              </div>
              <button type="button" onClick={addVersion} className="px-3 py-2 rounded-lg bg-amber-600/80 text-white text-xs">Agregar versión con contenido del formulario</button>

              <div className="flex gap-2 items-center text-xs">
                <span>Comparar</span>
                <input type="number" min={1} value={compareA} onChange={(e) => setCompareA(Number(e.target.value) || 1)} className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2 py-1" />
                <span>vs</span>
                <input type="number" min={1} value={compareB} onChange={(e) => setCompareB(Number(e.target.value) || 1)} className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2 py-1" />
                <button type="button" className="px-2 py-1 rounded border border-[var(--border-subtle)]" onClick={async () => {
                  setCompareResult(await compareModuleProposalVersions(selected.id, compareA, compareB));
                }}>Comparar</button>
              </div>
              {compareResult && (
                <pre className="text-[11px] overflow-auto max-h-40 bg-[var(--bg-hover)] p-2 rounded">{JSON.stringify(compareResult.diff_summary ?? compareResult, null, 2)}</pre>
              )}

              <div>
                <p className="text-xs font-semibold mb-1">Historial</p>
                <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                  {(selected.history ?? []).map((h) => (
                    <li key={h.id}>{new Date(h.created_at).toLocaleString()} · {h.action}: {h.detail}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
