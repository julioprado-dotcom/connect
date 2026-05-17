'use client';

import React from 'react';
import { VitalMonitor } from '@/components/onion200/VitalMonitor';
import { LiveFeed } from '@/components/onion200/LiveFeed';
import { SystemStatus } from '@/components/onion200/SystemStatus';

/**
 * ResumenView — Vista por defecto del puente de mando.
 * Muestra los 3 paneles principales: VitalMonitor, SystemStatus, LiveFeed.
 */
export function ResumenView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Vital Monitor (5 cols) */}
      <div className="lg:col-span-5">
        <VitalMonitor />
      </div>

      {/* System Status (4 cols) */}
      <div className="lg:col-span-4">
        <SystemStatus />
      </div>

      {/* Live Feed (3 cols) */}
      <div className="lg:col-span-3">
        <LiveFeed />
      </div>
    </div>
  );
}
