'use client';

import { SubPageShell } from '@/components/sub-page-shell';
import { UserMenu } from '@/components/user-menu';

export default function AgenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubPageShell
      title="Portal Agente"
      subtitle="Portal Agente"
      backHref="/"
      backLabel="Admin"
      accentColor="#00ff88"
    >
      <div className="flex items-center justify-end mb-2">
        <UserMenu compact />
      </div>
      {children}
    </SubPageShell>
  );
}
