/**
 * Zustand Store — DECODEX Bolivia Dashboard
 * Contiene solo estado TRUE global (accedido por ≥2 vistas o el shell).
 * Cada vista maneja su propio estado local (fetch, loading, paginación).
 */
import { create } from 'zustand';
import type { DashboardData, MediosHealthData } from '@/types/dashboard';
import { fetchWithTimeout, FETCH_TIMEOUT } from '@/lib/fetch-utils';

interface DashboardStore {
  // Shell state
  activeView: string;
  sidebarOpen: boolean;
  setActiveView: (viewId: string) => void;
  setSidebarOpen: (open: boolean) => void;

  // Global data (loaded once at init)
  data: DashboardData | null;
  loading: boolean;
  error: string;
  setData: (data: DashboardData) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string) => void;
  clearError: () => void;

  // Medios health (loaded at init, used by ResumenView + CapturaView)
  mediosHealth: MediosHealthData | null;
  setMediosHealth: (data: MediosHealthData) => void;

  // Initialization (deduplicated — only runs once)
  _initialized: boolean;
  initialize: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Shell
  activeView: 'resumen',
  sidebarOpen: false,
  setActiveView: (viewId) => set({ activeView: viewId, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Global data
  data: null,
  loading: true,
  error: '',
  setData: (data) => set({ data, loading: false, error: '' }),
  setLoading: (loading) => set({ loading }),
  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: '' }),

  // Medios health
  mediosHealth: null,
  setMediosHealth: (data) => set({ mediosHealth: data }),

  // Initialization guard
  _initialized: false,

  // Initialize — load global data once (deduplicated)
  initialize: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    // Both fetches in parallel with timeout
    const [statsResult, healthResult] = await Promise.allSettled([
      fetchWithTimeout('/api/stats', { timeoutMs: FETCH_TIMEOUT }),
      fetchWithTimeout('/api/medios/health', { timeoutMs: FETCH_TIMEOUT }),
    ]);

    // Process stats result
    if (statsResult.status === 'fulfilled' && statsResult.value.ok) {
      try {
        const json = await statsResult.value.json();
        set({ data: json, loading: false, error: '' });
      } catch {
        set({ error: 'Error al procesar datos del dashboard', loading: false });
      }
    } else {
      const reason = statsResult.status === 'rejected' ? statsResult.reason : 'Error al cargar datos';
      set({
        error: reason instanceof Error ? reason.message : String(reason),
        loading: false,
      });
    }

    // Process health result (non-critical — silent on failure)
    if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
      try {
        const json = await healthResult.value.json();
        set({ mediosHealth: json });
      } catch { /* silent */ }
    }
  },
}));
