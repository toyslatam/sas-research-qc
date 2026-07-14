'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConfiguredReport, ConfiguredReportRun, ReportStep, ReportStepType } from '@whispper/shared';
import {
  createConfiguredReport,
  deleteConfiguredReport,
  getConfiguredReport,
  listConfiguredReports,
  listReportProcesses,
  runConfiguredReport,
  updateConfiguredReport,
} from '@/lib/api';

const STEP_TYPES: ReportStepType[] = [
  'read_google_sheets',
  'filter_columns',
  'lookup_match',
  'cross_sheet',
  'update_columns',
  'add_columns',
  'delete_records',
  'send_email',
  'save_pdf',
  'call_openai',
  'call_api',
  'custom_javascript',
  'save_history',
];

function newStep(type: ReportStepType): ReportStep {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: type.replace(/_/g, ' '),
    config: {},
  };
}

export default function InformesModulePage() {
  const [reports, setReports] = useState<ConfiguredReport[]>([]);
  const [processes, setProcesses] = useState<Array<{ key: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<(ConfiguredReport & { runs?: ConfiguredReportRun[] }) | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Builder draft
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [processKey, setProcessKey] = useState('generic');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('Origen');
  const [responsible, setResponsible] = useState('');
  const [steps, setSteps] = useState<ReportStep[]>([]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, procs] = await Promise.all([
        listConfiguredReports(),
        listReportProcesses(),
      ]);
      setReports(rows);
      setProcesses(procs);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando informes');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    getConfiguredReport(selectedId)
      .then((d) => {
        setDetail(d);
        setSteps(d.steps ?? []);
        setName(d.name);
        setDescription(d.description);
        setProcessKey(d.process_key);
        setSheetId(d.source_spreadsheet_id);
        setSheetName(d.source_sheet);
        setResponsible(d.responsible);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error detalle'));
  }, [selectedId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nombre requerido');
      return;
    }
    try {
      const created = await createConfiguredReport({
        name,
        description,
        process_key: processKey,
        source_spreadsheet_id: sheetId,
        source_sheet: sheetName,
        responsible,
        steps,
        status: 'activo',
        configuration: {},
      });
      setSelectedId(created.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  async function handleSaveBuilder() {
    if (!selectedId) return;
    try {
      await updateConfiguredReport(selectedId, {
        name,
        description,
        process_key: processKey,
        source_spreadsheet_id: sheetId,
        source_sheet: sheetName,
        responsible,
        steps,
      });
      await load();
      setDetail(await getConfiguredReport(selectedId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  async function handleRun(markProcessed = false) {
    if (!selectedId) return;
    setRunning(true);
    setError(null);
    try {
      const out = await runConfiguredReport(selectedId, markProcessed);
      setLastResult(out.result);
      setDetail(await getConfiguredReport(selectedId));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error ejecutando informe');
    } finally {
      setRunning(false);
    }
  }

  function exportResult() {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-${selectedId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Módulo</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Informes Configurados</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Procesos reutilizables + constructor por bloques (estilo Power Automate / Make).
        </p>
      </header>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">{error}</div>}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <h2 className="font-semibold">Informes</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Cargando...</p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left rounded-xl border p-3 ${
                  selectedId === r.id
                    ? 'border-sky-500/40 bg-sky-500/10'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                }`}
              >
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {r.status} · {r.process_key} · {r.last_run_status || 'sin ejecución'}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
            <h2 className="font-semibold">Constructor de bloques</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm" />
              <select value={processKey} onChange={(e) => setProcessKey(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm">
                {processes.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Google Sheet ID" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm" />
              <input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Hoja origen" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm" />
              <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Responsable" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm" />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm" />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button type="submit" className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs">Crear informe</button>
                {selectedId && (
                  <button type="button" onClick={handleSaveBuilder} className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs">Guardar bloques</button>
                )}
              </div>
            </form>

            <div className="flex flex-wrap gap-2">
              {STEP_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSteps((s) => [...s, newStep(t)])}
                  className="px-2 py-1 rounded border border-[var(--border-subtle)] text-[10px] hover:bg-[var(--bg-hover)]"
                >
                  + {t}
                </button>
              ))}
            </div>

            <ol className="space-y-2">
              {steps.map((step, idx) => (
                <li key={step.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-2 text-xs flex items-center justify-between gap-2">
                  <span>{idx + 1}. {step.label} <span className="text-[var(--text-muted)]">({step.type})</span></span>
                  <button type="button" className="text-rose-300" onClick={() => setSteps((s) => s.filter((x) => x.id !== step.id))}>Quitar</button>
                </li>
              ))}
              {steps.length === 0 && <p className="text-xs text-[var(--text-muted)]">Sin bloques. Agrega pasos arriba.</p>}
            </ol>
          </div>

          {selected && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{selected.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">{selected.description}</p>
                </div>
                <button type="button" className="text-xs text-rose-300" onClick={async () => {
                  await deleteConfiguredReport(selected.id);
                  setSelectedId(null);
                  await load();
                }}>Eliminar</button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={running} onClick={() => handleRun(false)} className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs disabled:opacity-60">
                  {running ? 'Ejecutando...' : 'Ejecutar'}
                </button>
                <button type="button" disabled={running} onClick={() => handleRun(true)} className="px-3 py-2 rounded-lg border border-sky-500/40 text-sky-300 text-xs disabled:opacity-60">
                  Ejecutar + marcar procesados
                </button>
                <button type="button" onClick={exportResult} disabled={!lastResult} className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs disabled:opacity-50">
                  Exportar resultado
                </button>
              </div>

              {lastResult && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="rounded bg-[var(--bg-hover)] p-2">Procesados: <b>{String(lastResult.processed ?? 0)}</b></div>
                  <div className="rounded bg-[var(--bg-hover)] p-2">No encontrados: <b>{String(lastResult.not_found ?? 0)}</b></div>
                  <div className="rounded bg-[var(--bg-hover)] p-2">Duplicados: <b>{String(lastResult.duplicates ?? 0)}</b></div>
                  <div className="rounded bg-[var(--bg-hover)] p-2">Errores: <b>{String(lastResult.errors ?? 0)}</b></div>
                  <div className="rounded bg-[var(--bg-hover)] p-2">ms: <b>{String(lastResult.duration_ms ?? 0)}</b></div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold mb-1">Historial de ejecuciones</p>
                <ul className="space-y-1 text-xs text-[var(--text-muted)] max-h-40 overflow-auto">
                  {(detail?.runs ?? []).map((run) => (
                    <li key={run.id}>
                      {new Date(run.created_at).toLocaleString()} · {run.status} · P:{run.processed} NF:{run.not_found} D:{run.duplicates} E:{run.errors} · {run.duration_ms}ms
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
