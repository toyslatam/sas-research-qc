'use client';

import type { Project } from '@whispper/shared';

const baseCls =
  'whispper-select px-3 py-2 text-sm rounded-xl border border-white/[0.12] bg-[#0b1525] text-slate-100 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 min-w-[200px] cursor-pointer';

interface ProjectSelectProps {
  projects: Project[];
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
  compact?: boolean;
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  placeholder = '— Selecciona un proyecto —',
  allowEmpty = true,
  className = '',
  compact = false,
}: ProjectSelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) =>
        onChange(e.target.value ? parseInt(e.target.value, 10) : null)
      }
      className={`${baseCls} ${compact ? 'py-1.5' : ''} ${className}`}
      aria-label="Proyecto"
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
