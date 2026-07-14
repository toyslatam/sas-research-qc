'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getStoredProjectId,
  PROJECT_STORAGE_KEY,
  setStoredProjectId,
} from '@/lib/projectSelection';

interface ProjectContextValue {
  projectId: number | null;
  setProjectId: (id: number | null) => void;
  hydrated: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectId: null,
  setProjectId: () => {},
  hydrated: false,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProjectIdState(getStoredProjectId());
    setHydrated(true);
  }, []);

  const setProjectId = useCallback((id: number | null) => {
    setProjectIdState(id);
    setStoredProjectId(id);
    window.dispatchEvent(new CustomEvent('whispper:project-change', { detail: id }));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PROJECT_STORAGE_KEY) return;
      const next = e.newValue ? parseInt(e.newValue, 10) : null;
      setProjectIdState(Number.isFinite(next) ? next : null);
    };
    const onCustom = (e: Event) => {
      setProjectIdState((e as CustomEvent<number | null>).detail ?? null);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('whispper:project-change', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('whispper:project-change', onCustom);
    };
  }, []);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId, hydrated }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  return useContext(ProjectContext);
}
