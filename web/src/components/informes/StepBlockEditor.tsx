'use client';

import type { ReactNode } from 'react';
import type { ReportStep, ReportStepType } from '@whispper/shared';

export const STEP_META: Record<
  ReportStepType,
  { label: string; hint: string; howTo: string }
> = {
  read_google_sheets: {
    label: 'Leer Google Sheets',
    hint: 'Trae las filas de una hoja',
    howTo:
      'Indica la hoja a leer. Si la dejas vacía, usa la hoja origen de la plantilla. Este bloque suele ir primero.',
  },
  filter_columns: {
    label: 'Filtrar columnas',
    hint: 'Deja solo filas que cumplan valores',
    howTo:
      'Escribe el nombre exacto de la columna del Sheet (ej. Estado) y los valores permitidos separados por coma (ej. Aprobado, Aprobada).',
  },
  lookup_match: {
    label: 'Buscar coincidencia',
    hint: 'Busca un valor en otra hoja',
    howTo:
      'Columna en tus filas + hoja de búsqueda + columna clave en esa hoja. Se enriquece la fila si hay match.',
  },
  cross_sheet: {
    label: 'Cruzar hojas',
    hint: 'Une datos entre dos hojas (como Power Query)',
    howTo:
      'Igual que una búsqueda VLOOKUP: indica hoja auxiliar, columna clave en origen y columna clave en la hoja auxiliar.',
  },
  update_columns: {
    label: 'Actualizar columnas',
    hint: 'Modifica valores de columnas existentes',
    howTo: 'Indica la columna a actualizar y el valor fijo que quieres poner en todas las filas actuales.',
  },
  add_columns: {
    label: 'Agregar columnas',
    hint: 'Crea columnas nuevas en el resultado',
    howTo: 'Nombre de la columna nueva y valor por defecto (puede quedar vacío).',
  },
  delete_records: {
    label: 'Eliminar registros',
    hint: 'Quita filas según una condición',
    howTo:
      'Columna + valores a eliminar (separados por coma). Si marcas “solo vacíos”, quita filas donde esa columna esté vacía.',
  },
  send_email: {
    label: 'Enviar correo',
    hint: 'Notifica el resultado por email',
    howTo: 'Correo destino y asunto. (Ejecución de envío real según configuración del servidor.)',
  },
  save_pdf: {
    label: 'Guardar PDF',
    hint: 'Genera un PDF del resultado',
    howTo: 'Nombre del archivo PDF de salida.',
  },
  call_openai: {
    label: 'Llamar a IA',
    hint: 'Usa OpenAI sobre las filas',
    howTo: 'Prompt o instrucción que la IA aplicará al lote de filas.',
  },
  call_api: {
    label: 'Llamar API',
    hint: 'Consulta un endpoint externo',
    howTo: 'URL del endpoint. Método GET/POST según necesites.',
  },
  custom_javascript: {
    label: 'JavaScript personalizado',
    hint: 'Lógica avanzada (admin)',
    howTo: 'Solo para casos especiales. Deja una nota de qué debe hacer este paso.',
  },
  save_history: {
    label: 'Guardar historial',
    hint: 'Registra la ejecución',
    howTo: 'No requiere campos. Guarda que esta corrida quedó registrada en el historial.',
  },
};

export function defaultConfigFor(type: ReportStepType): Record<string, unknown> {
  switch (type) {
    case 'read_google_sheets':
      return { sheet_name: '' };
    case 'filter_columns':
      return { column: 'Estado', values: 'Aprobado, Aprobada, Aprobado', mode: 'include' };
    case 'lookup_match':
    case 'cross_sheet':
      return {
        lookup_sheet: 'Localizaciones',
        source_key: 'Localización',
        lookup_key: 'Localización',
      };
    case 'update_columns':
      return { column: 'Revisado', value: 'X' };
    case 'add_columns':
      return { column: 'Origen', value: 'SAS RESEARCH' };
    case 'delete_records':
      return { column: 'Revisado', values: 'X', empty_only: false };
    case 'send_email':
      return { to: '', subject: 'Informe generado' };
    case 'save_pdf':
      return { filename: 'informe.pdf' };
    case 'call_openai':
      return { prompt: '' };
    case 'call_api':
      return { url: '', method: 'GET' };
    case 'custom_javascript':
      return { note: '' };
    case 'save_history':
      return {};
    default:
      return {};
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-[var(--text-muted)] leading-snug">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]';

export function StepBlockEditor({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: ReportStep;
  index: number;
  onChange: (next: ReportStep) => void;
  onRemove: () => void;
}) {
  const meta = STEP_META[step.type];
  const cfg = step.config ?? {};

  function setConfig(patch: Record<string, unknown>) {
    onChange({ ...step, config: { ...cfg, ...patch } });
  }

  return (
    <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {index + 1}. {meta?.label ?? step.label}
          </p>
          <p className="text-[11px] text-sky-300/90 mt-1 leading-snug">{meta?.howTo}</p>
        </div>
        <button type="button" className="text-rose-300 text-xs shrink-0" onClick={onRemove}>
          Quitar
        </button>
      </div>

      <Field label="Nombre del paso (cómo lo verás en la lista)">
        <input
          className={inputClass}
          value={step.label}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
        />
      </Field>

      {step.type === 'read_google_sheets' && (
        <Field
          label="Hoja a leer"
          hint="Ej. Origen. Vacío = usa la hoja origen de la plantilla."
        >
          <input
            className={inputClass}
            value={String(cfg.sheet_name ?? '')}
            placeholder="Origen"
            onChange={(e) => setConfig({ sheet_name: e.target.value })}
          />
        </Field>
      )}

      {step.type === 'filter_columns' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Columna" hint="Nombre exacto como en el Sheet">
            <input
              className={inputClass}
              value={String(cfg.column ?? '')}
              placeholder="Estado"
              onChange={(e) => setConfig({ column: e.target.value })}
            />
          </Field>
          <Field label="Valores permitidos" hint="Separados por coma">
            <input
              className={inputClass}
              value={String(cfg.values ?? '')}
              placeholder="Aprobado, Aprobada"
              onChange={(e) => setConfig({ values: e.target.value })}
            />
          </Field>
        </div>
      )}

      {(step.type === 'lookup_match' || step.type === 'cross_sheet') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Hoja auxiliar" hint="Otra pestaña del mismo Sheet">
            <input
              className={inputClass}
              value={String(cfg.lookup_sheet ?? '')}
              placeholder="Localizaciones"
              onChange={(e) => setConfig({ lookup_sheet: e.target.value })}
            />
          </Field>
          <Field label="Columna en origen" hint="Clave en tus filas">
            <input
              className={inputClass}
              value={String(cfg.source_key ?? '')}
              placeholder="Localización"
              onChange={(e) => setConfig({ source_key: e.target.value })}
            />
          </Field>
          <Field label="Columna en hoja auxiliar" hint="Clave para cruzar">
            <input
              className={inputClass}
              value={String(cfg.lookup_key ?? '')}
              placeholder="Localización"
              onChange={(e) => setConfig({ lookup_key: e.target.value })}
            />
          </Field>
        </div>
      )}

      {step.type === 'update_columns' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Columna a actualizar">
            <input
              className={inputClass}
              value={String(cfg.column ?? '')}
              onChange={(e) => setConfig({ column: e.target.value })}
            />
          </Field>
          <Field label="Nuevo valor">
            <input
              className={inputClass}
              value={String(cfg.value ?? '')}
              onChange={(e) => setConfig({ value: e.target.value })}
            />
          </Field>
        </div>
      )}

      {step.type === 'add_columns' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Nombre de columna nueva">
            <input
              className={inputClass}
              value={String(cfg.column ?? '')}
              onChange={(e) => setConfig({ column: e.target.value })}
            />
          </Field>
          <Field label="Valor por defecto">
            <input
              className={inputClass}
              value={String(cfg.value ?? '')}
              onChange={(e) => setConfig({ value: e.target.value })}
            />
          </Field>
        </div>
      )}

      {step.type === 'delete_records' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Columna">
            <input
              className={inputClass}
              value={String(cfg.column ?? '')}
              onChange={(e) => setConfig({ column: e.target.value })}
            />
          </Field>
          <Field label="Valores a eliminar" hint="Separados por coma">
            <input
              className={inputClass}
              value={String(cfg.values ?? '')}
              onChange={(e) => setConfig({ values: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(cfg.empty_only)}
              onChange={(e) => setConfig({ empty_only: e.target.checked })}
            />
            Solo eliminar filas donde la columna esté vacía
          </label>
        </div>
      )}

      {step.type === 'send_email' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Correo destino">
            <input
              className={inputClass}
              value={String(cfg.to ?? '')}
              onChange={(e) => setConfig({ to: e.target.value })}
            />
          </Field>
          <Field label="Asunto">
            <input
              className={inputClass}
              value={String(cfg.subject ?? '')}
              onChange={(e) => setConfig({ subject: e.target.value })}
            />
          </Field>
        </div>
      )}

      {step.type === 'save_pdf' && (
        <Field label="Nombre del PDF">
          <input
            className={inputClass}
            value={String(cfg.filename ?? '')}
            onChange={(e) => setConfig({ filename: e.target.value })}
          />
        </Field>
      )}

      {step.type === 'call_openai' && (
        <Field label="Instrucción / prompt" hint="Qué debe hacer la IA con las filas">
          <textarea
            className={`${inputClass} min-h-[64px]`}
            value={String(cfg.prompt ?? '')}
            onChange={(e) => setConfig({ prompt: e.target.value })}
          />
        </Field>
      )}

      {step.type === 'call_api' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="URL" hint="Endpoint completo">
            <input
              className={inputClass}
              value={String(cfg.url ?? '')}
              onChange={(e) => setConfig({ url: e.target.value })}
            />
          </Field>
          <Field label="Método">
            <select
              className={inputClass}
              value={String(cfg.method ?? 'GET')}
              onChange={(e) => setConfig({ method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </Field>
        </div>
      )}

      {step.type === 'custom_javascript' && (
        <Field label="Nota / descripción del paso">
          <textarea
            className={`${inputClass} min-h-[64px]`}
            value={String(cfg.note ?? '')}
            onChange={(e) => setConfig({ note: e.target.value })}
          />
        </Field>
      )}

      {step.type === 'save_history' && (
        <p className="text-[11px] text-[var(--text-muted)]">
          Este bloque no pide datos: solo deja constancia en el historial al generar.
        </p>
      )}
    </li>
  );
}
