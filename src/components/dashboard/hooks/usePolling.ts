'use client';

import { useEffect, useRef } from 'react';

/**
 * Polling hook with debounce onFocus.
 * Pauses polling when tab is not visible, resumes on focus.
 * Minimum interval 30s. Immediate fetch on focus recovery.
 *
 * FIX MEMORIA: Antes este hook tenía 3 bugs de acumulación:
 * 1. visibilitychange listener nunca se removía
 * 2. onFocus() creaba NUEVOS setInterval sin limpiar los anteriores
 * 3. Cleanup no removía ni el listener ni los intervals creados por onFocus
 */
export function usePolling(fetchFn: () => void | Promise<void>, intervalMs: number = 30_000) {
  // Ref para el interval creado por onFocus, para poder limpiarlo en cleanup
  const onFocusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fetch inicial
    fetchFn();

    // Interval principal de polling
    const mainInterval = setInterval(fetchFn, intervalMs);

    // Handler de visibilidad: pausa al ocultar, reanuda al mostrar
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Tab visible: fetch inmediato + reanudar polling
        fetchFn();

        // Limpiar interval previo de onFocus si existe (previene acumulación)
        if (onFocusIntervalRef.current) {
          clearInterval(onFocusIntervalRef.current);
        }

        // Crear nuevo interval de onFocus
        onFocusIntervalRef.current = setInterval(fetchFn, intervalMs);
      } else {
        // Tab oculto: pausar polling (ambos intervals)
        clearInterval(mainInterval);
        if (onFocusIntervalRef.current) {
          clearInterval(onFocusIntervalRef.current);
          onFocusIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Cleanup completo al desmontar o re-renderizar
    return () => {
      clearInterval(mainInterval);
      if (onFocusIntervalRef.current) {
        clearInterval(onFocusIntervalRef.current);
        onFocusIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchFn, intervalMs]);
}
