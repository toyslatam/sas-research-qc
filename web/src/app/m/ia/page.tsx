'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AiMeetingAnalysis, ManagedProject } from '@whispper/shared';
import { analyzeMeetingAudio, listAiAnalyses, listManagedProjects } from '@/lib/api';

export default function AiModulePage() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [analyses, setAnalyses] = useState<AiMeetingAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const loadProjects = useCallback(async () => {
    const rows = await listManagedProjects({});
    setProjects(rows);
    if (!selectedProjectId && rows.length) {
      setSelectedProjectId(rows[0].id);
    }
  }, [selectedProjectId]);

  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAiAnalyses(selectedProjectId ?? undefined);
      setAnalyses(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar análisis');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects().catch((e) => setError(e instanceof Error ? e.message : 'Error cargando proyectos'));
  }, [loadProjects]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  async function handleProcess(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Selecciona un proyecto.');
      return;
    }
    if (!audioFile) {
      setError('Selecciona un archivo de audio.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      await analyzeMeetingAudio({
        managedProjectId: selectedProjectId,
        meetingTitle: meetingTitle.trim() || 'Reunión sin título',
        targetLanguage,
        audioFile,
      });
      setMeetingTitle('');
      setAudioFile(null);
      await loadAnalyses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el audio');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Módulo</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">IA</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Sube audio, transcribe, traduce, analiza reuniones y guarda acuerdos, tareas, riesgos y decisiones por proyecto.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <form onSubmit={handleProcess} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            >
              <option value="">Selecciona proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Título de reunión"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            />
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 text-sm outline-none focus:border-emerald-500/50"
            >
              <option value="en">Traducir a Inglés</option>
              <option value="pt">Traducir a Portugués</option>
              <option value="fr">Traducir a Francés</option>
              <option value="es">Sin traducción (Español)</option>
            </select>
          </div>

          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-sm hover:file:bg-emerald-500"
          />

          <button
            type="submit"
            disabled={processing}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {processing ? 'Procesando audio...' : 'Transcribir, traducir y analizar'}
          </button>
        </form>
      </section>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Análisis guardados {selectedProject ? `· ${selectedProject.name}` : ''}
          </h2>
          <button
            type="button"
            onClick={loadAnalyses}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Recargar
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Cargando análisis...</p>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No hay análisis aún para este filtro.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analyses.map((analysis) => (
              <article
                key={analysis.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {analysis.meeting_title || 'Reunión sin título'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Archivo: {analysis.source_filename} · {new Date(analysis.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    {analysis.target_language.toUpperCase()}
                  </span>
                </div>

                <p className="text-sm text-[var(--text-muted)]">{analysis.summary || 'Sin resumen'}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                    Acuerdos: <span className="font-semibold">{analysis.agreements.length}</span>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                    Tareas: <span className="font-semibold">{analysis.tasks.length}</span>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                    Riesgos: <span className="font-semibold">{analysis.risks.length}</span>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-hover)] px-2 py-1.5">
                    Decisiones: <span className="font-semibold">{analysis.decisions.length}</span>
                  </div>
                </div>

                {analysis.agreements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">Acuerdos</p>
                    <ul className="space-y-1 text-xs text-[var(--text-muted)] list-disc pl-4">
                      {analysis.agreements.slice(0, 3).map((item, idx) => (
                        <li key={`${analysis.id}-agr-${idx}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.tasks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">Tareas</p>
                    <ul className="space-y-1 text-xs text-[var(--text-muted)] list-disc pl-4">
                      {analysis.tasks.slice(0, 3).map((task, idx) => (
                        <li key={`${analysis.id}-task-${idx}`}>
                          {task.title} {task.owner ? `(${task.owner})` : ''} {task.due_date ? `· ${task.due_date}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

