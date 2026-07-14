'use client';

import { useCallback, useEffect, useState } from 'react';
import { useProjectContext } from '@/components/ProjectContext';
import type { FilterState } from '@/components/DashboardFilters';

export function usePersistedProjectFilters(initial: FilterState = {}) {
  const { projectId: storedId, setProjectId, hydrated } = useProjectContext();
  const [filters, setFiltersState] = useState<FilterState>(initial);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!hydrated || synced) return;
    if (storedId && !filters.projectId) {
      setFiltersState((f) => ({ ...f, projectId: storedId }));
    }
    setSynced(true);
  }, [hydrated, storedId, synced, filters.projectId]);

  const setFilters = useCallback(
    (next: FilterState | ((prev: FilterState) => FilterState)) => {
      setFiltersState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (resolved.projectId !== prev.projectId) {
          setProjectId(resolved.projectId ?? null);
        }
        return resolved;
      });
    },
    [setProjectId],
  );

  return { filters, setFilters, hydrated: hydrated && synced };
}
