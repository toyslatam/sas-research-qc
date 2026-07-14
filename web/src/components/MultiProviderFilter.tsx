'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function MultiProviderFilter({ options, selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const label = selected.length === 0
    ? 'Todos los proveedores'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} proveedores`;

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name],
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 whispper-select bg-[#0b1525] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-left">{options.length === 0 ? 'Sin proveedores' : label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-xl border border-white/[0.12] bg-[#0b1525] shadow-xl shadow-black/40 overflow-hidden">
          <div className="p-2 border-b border-white/[0.08]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-black/30 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between mt-2 px-0.5">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                onClick={() => { onChange([]); setSearch(''); }}
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            </div>
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-xs text-slate-500 text-center">Sin coincidencias</li>
            )}
            {filtered.map((name) => {
              const checked = selected.includes(name);
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                      checked ? 'bg-violet-500/10 text-violet-200' : 'text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-violet-500 border-violet-500'
                          : 'border-white/20 bg-black/20'
                      }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate leading-snug">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
