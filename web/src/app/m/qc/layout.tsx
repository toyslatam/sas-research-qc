import type { ReactNode } from 'react';
import { QcModuleNav } from '@/modules/qc/components/QcModuleNav';

export default function QcLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <QcModuleNav />
      {children}
    </>
  );
}
