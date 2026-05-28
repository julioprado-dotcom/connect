'use client';

import { SubPageShell } from '@/components/sub-page-shell';

export default function EntregasLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubPageShell
      title="Entregas"
      subtitle="Gestión de Entregas · ONION200"
    >
      {children}
    </SubPageShell>
  );
}
