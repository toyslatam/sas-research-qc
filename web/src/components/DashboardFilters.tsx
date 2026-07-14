'use client';

import { useEffect, useState } from 'react';
import type { Project } from '@whispper/shared';
import { apiUrl } from '@/lib/apiBase';
import { ProjectSelect } from '@/components/ProjectSelect';
import { MultiProviderFilter } from '@/components/MultiProviderFilter';

export interface FilterState {
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
  segment?: string;
  moduleType?: 'propuesta' | 'exploratorio';
  /** Participant names — filtered client-side on dashboard */
  providers?: string[];
}

interface Props {
  projects: Project[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  providerOptions?: string[];
}

export function DashboardFilters({ projects, filters, onChange, providerOptions = [] }: Props) {
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Todas las categorías' },
  ]);

  useEffect(() => {
    if (!filters.projectId) {
      setCategoryOptions([{ value: '', label: 'Todas las categorías' }]);
      return;
    }
    fetch(apiUrl(`/api/projects/${filters.projectId}/categories`))
      .then((r) => r.json())
      .then((cats: { name: string }[]) => {
        setCategoryOptions([
          { value: '', label: 'Todas las categorías' },
          ...cats.map((c) => ({ value: c.name, label: c.name })),
        ]);
      })
      .catch(() => {
        setCategoryOptions([{ value: '', label: 'Todas las categorías' }]);
      });
  }, [filters.projectId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 p-4 bg-slate-900 rounded-xl border border-slate-800">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Proyecto</label>
        <ProjectSelect
          projects={projects}
          value={filters.projectId}
          onChange={(id) =>
            onChange({
              ...filters,
              projectId: id ?? undefined,
            })
          }
          placeholder="Todos"
          allowEmpty
          className="w-full min-w-0"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Desde</label>
        <input
          type="date"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Hasta</label>
        <input
          type="date"
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Proveedores</label>
        <MultiProviderFilter
          options={providerOptions}
          selected={filters.providers ?? []}
          onChange={(providers) => onChange({ ...filters, providers })}
          disabled={!filters.projectId && providerOptions.length === 0}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Categoría</label>
        <select
          className="w-full whispper-select bg-[#0b1525] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-slate-100"
          value={filters.segment ?? ''}
          onChange={(e) =>
            onChange({ ...filters, segment: e.target.value || undefined })
          }
        >
          {categoryOptions.map((s) => (
            <option key={s.value || 'all'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
