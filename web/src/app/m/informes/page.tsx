'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConfiguredReport,
  ConfiguredReportRun,
  ReportStep,
  ReportStepType,
} from '@whispper/shared';
import {
  createConfiguredReport,
  deleteConfiguredReport,
  getConfiguredReport,
  listConfiguredReports,
  listReportProcesses,
  runConfiguredReport,
  updateConfiguredReport,
} from '@/lib/api';
import { downloadReportRows } from '@/lib/exportConfiguredReport';

type Tab = 'generar' | 'configurar';

const STEP_META: Record<ReportStepType, { label: string; hint: string }> = {
  read_google_sheets: {
    label: 'Leer Google Sheets',
    hint: 'Trae las filas de la hoja origen',
  },
  filter_columns: {
    label: 'Filtrar columnas',
    hint: 'Deja solo filas que cumplan valores (ej. Estado = Aprobado)',
  },
  lookup_match: {
    label: 'Buscar coincidencia',
    hint: 'Busca un valor en otra hoja',
  },
  cross_sheet: {
    label: 'Cruzar hojas',
    hint: 'Une datos entre dos hojas (como Power Query)',
  },
  update_columns: {
    label: 'Actualizar columnas',
    hint: 'Modifica valores de columnas existentes',
  },
  add_columns: {
    label: 'Agregar columnas',
    hint: 'Crea columnas nuevas en el resultado',
  },
  delete_records: {
    label: 'Eliminar registros',
    hint: 'Quita filas según una condición',
  },
  send_email: {
    label: 'Enviar correo',
    hint: 'Notifica el resultado por email',
  },
  save_pdf: {
    label: 'Guardar PDF',
    hint: 'Genera un PDF del resultado',
  },
  call_openai: {
    label: 'Llamar a IA',
    hint: 'Usa OpenAI sobre las filas',
  },
  call_api: {
    label: 'Llamar API',
    hint: 'Consulta un endpoint externo',
  },
  custom_javascript: {
    label: 'JavaScript personalizado',
    hint: 'Lógica avanzada (admin)',
  },
  save_history: {
    label: 'Guardar historial',
    hint: 'Registra la ejecución',
  },
};

const STEP_TYPES = Object.keys(STEP_META) as ReportStepType[];

function newStep(type: ReportStepType): ReportStep {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: STEP_META[type].label,
    config: {},
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function InformesModulePage() {
  const [tab, setTab] = useState<Tab>('generar');
  const [reports, setReports] = useState<ConfiguredReport[]>([]);
  const [processes, setProcesses] = useState<Array<{ key: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<(ConfiguredReport & { runs?: ConfiguredReportRun[] }) | null>(
    null,
  );
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Generar
  const [dateFrom, setDateFrom] = useState(daysAgoISO(7));
  const [dateTo, setDateTo] = useState(todayISO());

  // Configurar
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [processKey, setProcessKey] = useState('generic');
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('Origen');
  const [responsible, setResponsible] = useState('');
  const [dateColumn, setDateColumn] = useState('Fecha');
  const [steps, setSteps] = useState<ReportStep[]>([]);

  const activeReports = useMemo(
    () => reports.filter((r) => r.status === 'activo'),
    [reports],
  );

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
      if (!selectedId && rows.length) {
        const firstActive = rows.find((r) => r.status === 'activo') ?? rows[0];
        setSelectedId(firstActive.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando informes');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
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
        setSheetName(d.source_sheet || 'Origen');
        setResponsible(d.responsible);
        setDateColumn(String(d.configuration?.date_column ?? 'Fecha'));
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
        configuration: { date_column: dateColumn.trim() || 'Fecha' },
      });
      setSelectedId(created.id);
      await load();
      setTab('generar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
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
        configuration: {
          ...(detail?.configuration ?? {}),
          date_column: dateColumn.trim() || 'Fecha',
        },
      });
      await load();
      setDetail(await getConfiguredReport(selectedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  async function handleGenerate(format: 'xlsx' | 'csv', markProcessed = false) {
    if (!selectedId || !selected) return;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('La fecha desde no puede ser mayor que la fecha hasta');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const out = await runConfiguredReport(selectedId, {
        markProcessed,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setLastResult(out.result);
      setDetail(await getConfiguredReport(selectedId));
      await load();

      const rows = Array.isArray(out.result.rows)
        ? (out.result.rows as Record<string, unknown>[])
        : [];
      downloadReportRows(rows, selected.name, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando informe');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Módulo</p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Informes Configurados</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Elige fechas y descarga el Excel estándar. La configuración del Sheet y los bloques es solo
          para armar la plantilla.
        </p>
      </header>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2">
        <button
          type="button"
          onClick={() => setTab('generar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'generar'
              ? 'bg-sky-600 text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Generar y descargar
        </button>
        <button
          type="button"
          onClick={() => setTab('configurar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'configurar'
              ? 'bg-sky-600 text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Configurar plantilla
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
          {error}
        </div>
      )}

      {tab === 'generar' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">1. Elige el informe</h2>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Cargando…</p>
            ) : activeReports.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No hay plantillas activas. Ve a <b>Configurar plantilla</b> para crear una.
              </p>
            ) : (
              activeReports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(r.id);
                    setLastResult(null);
                  }}
                  className={`w-full text-left rounded-xl border p-3 ${
                    selectedId === r.id
                      ? 'border-sky-500/40 bg-sky-500/10'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                  }`}
                >
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                    {r.description || r.process_key}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
              <h2 className="font-semibold">2. Elige fechas y descarga</h2>
              {!selected ? (
                <p className="text-sm text-[var(--text-muted)]">Selecciona un informe a la izquierda.</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-muted)]">
                    Plantilla: <b className="text-[var(--text-primary)]">{selected.name}</b>
                    {selected.configuration?.date_column
                      ? ` · Filtra por columna “${String(selected.configuration.date_column)}”`
                      : ' · Filtra por columna “Fecha”'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm space-y-1">
                      <span className="text-[var(--text-muted)]">Desde</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm space-y-1">
                      <span className="text-[var(--text-muted)]">Hasta</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => handleGenerate('xlsx')}
                      className="px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium disabled:opacity-60"
                    >
                      {running ? 'Generando…' : 'Generar y descargar Excel'}
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => handleGenerate('csv')}
                      className="px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] text-sm disabled:opacity-60"
                    >
                      Descargar CSV
                    </button>
                  </div>
                  {lastResult && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="rounded bg-[var(--bg-hover)] p-2">
                        Filas: <b>{String(lastResult.processed ?? 0)}</b>
                      </div>
                      <div className="rounded bg-[var(--bg-hover)] p-2">
                        No encontrados: <b>{String(lastResult.not_found ?? 0)}</b>
                      </div>
                      <div className="rounded bg-[var(--bg-hover)] p-2">
                        Duplicados: <b>{String(lastResult.duplicates ?? 0)}</b>
                      </div>
                      <div className="rounded bg-[var(--bg-hover)] p-2">
                        ms: <b>{String(lastResult.duration_ms ?? 0)}</b>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {selected && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <p className="text-xs font-semibold mb-2">Historial reciente</p>
                <ul className="space-y-1 text-xs text-[var(--text-muted)] max-h-36 overflow-auto">
                  {(detail?.runs ?? []).slice(0, 10).map((run) => (
                    <li key={run.id}>
                      {new Date(run.created_at).toLocaleString()} · {run.status} ·{' '}
                      {run.processed} filas · {run.duration_ms}ms
                    </li>
                  ))}
                  {(detail?.runs ?? []).length === 0 && <li>Sin ejecuciones aún.</li>}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'configurar' && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Plantillas</h2>
            {reports.map((r) => (
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
                  {r.status} · {r.process_key}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <h2 className="font-semibold">Fuente Google Sheets + bloques</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Esto reemplaza el Power Query: defines una vez qué hacer con el Sheet. Luego el usuario
                solo genera por fechas.
              </p>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del informe"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <select
                  value={processKey}
                  onChange={(e) => setProcessKey(e.target.value)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                >
                  {processes.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="ID de Google Sheet"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Nombre de la hoja origen"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <input
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  placeholder="Columna de fecha (ej. Fecha)"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <input
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Responsable"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción"
                  className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-sm"
                />
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <button type="submit" className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs">
                    Crear plantilla
                  </button>
                  {selectedId && (
                    <button
                      type="button"
                      onClick={handleSaveBuilder}
                      className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs"
                    >
                      Guardar cambios
                    </button>
                  )}
                  {selectedId && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-xs text-rose-300"
                      onClick={async () => {
                        await deleteConfiguredReport(selectedId);
                        setSelectedId(null);
                        await load();
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </form>

              <div>
                <p className="text-xs font-semibold mb-2">Agregar bloque</p>
                <div className="flex flex-wrap gap-2">
                  {STEP_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      title={STEP_META[t].hint}
                      onClick={() => setSteps((s) => [...s, newStep(t)])}
                      className="px-2 py-1 rounded border border-[var(--border-subtle)] text-[11px] hover:bg-[var(--bg-hover)]"
                    >
                      + {STEP_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <ol className="space-y-2">
                {steps.map((step, idx) => (
                  <li
                    key={step.id}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-2 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <p>
                        {idx + 1}. {step.label}
                      </p>
                      <p className="text-[var(--text-muted)] mt-0.5">
                        {STEP_META[step.type]?.hint ?? step.type}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-rose-300 shrink-0"
                      onClick={() => setSteps((s) => s.filter((x) => x.id !== step.id))}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
                {steps.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Sin bloques. Agrega pasos arriba (o usa el proceso “Validación de Localizaciones”).
                  </p>
                )}
              </ol>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
