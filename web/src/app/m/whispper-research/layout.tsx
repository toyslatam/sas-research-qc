import type { ReactNode } from 'react';
import { ResearchModuleNav } from '@/modules/whispper-research/components/ResearchModuleNav';

export default function WhispperResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResearchModuleNav />
      {children}
    </>
  );
}
