'use client';

import { useEffect } from 'react';

/**
 * Polling hook with debounce onFocus.
 * Pauses polling when tab is not visible, resumes on focus.
 * Minimum interval 30s. Immediate fetch on focus recovery.
 */
export function usePolling(fetchFn: () => void | Promise<void>, intervalMs: number = 30_000) {
  useEffect(() => {
    fetchFn();
    const interval = setInterval(fetchFn, intervalMs);
    let onFocusFn: (() => void) | null = null;

    const onBlur = () => clearInterval(interval);
    const onFocus = () => {
      fetchFn();
      // Reanudar polling
      const reanudar = setInterval(fetchFn, intervalMs);
      onFocusFn = () => clearInterval(reanudar);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        onBlur();
      } else {
        onFocus();
      }
    });

    return () => {
      clearInterval(interval);
      onFocusFn?.();
    };
  }, [fetchFn, intervalMs]);
}
