'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { BoletinExpress } from '../BoletinExpress';

// ─── Component ──────────────────────────────────────────────

export function BoletinExpressPanel({ onClose }: { onClose?: () => void }) {
  return (
    <PanelShell
      title="Boletín Express"
      icon={<Zap className="w-4 h-4" />}
      onClose={onClose}
    >
      <div className="p-4">
        <BoletinExpress />
      </div>
    </PanelShell>
  );
}
