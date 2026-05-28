'use client';

import { SubPageShell } from '@/components/sub-page-shell';

export default function ContratoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubPageShell
      title="Contrato"
      subtitle="Detalle de Contrato"
      backHref="/clientes"
      backLabel="Clientes"
    >
      {children}
    </SubPageShell>
  );
}
