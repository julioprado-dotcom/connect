'use client';

import { SubPageShell } from '@/components/sub-page-shell';
import { UserMenu } from '@/components/user-menu';

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubPageShell
      title="Clientes"
      subtitle="Gestión Comercial · Clientes"
    >
      <div className="flex items-center justify-end mb-2">
        <UserMenu compact />
      </div>
      {children}
    </SubPageShell>
  );
}
