'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isUp = value > 0;
  const isNeutral = value === 0;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {isNeutral ? (
        <Minus className="h-3 w-3 text-stone-400" />
      ) : isUp ? (
        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
      ) : (
        <ArrowDownRight className="h-3 w-3 text-red-500" />
      )}
      <span className={isNeutral ? '' : isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
        {Math.abs(value)}%
      </span>
      <span>{label}</span>
    </div>
  );
}
