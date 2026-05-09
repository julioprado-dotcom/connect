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

  // Collapsible sidebar groups
  expandedGroups: string[];
  toggleGroup: (groupId: string) => void;

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

  // Collapsible sidebar groups (sections + sub-items)
  expandedGroups: ['analisis', 'onion200', 'comercial', 'config', 'menciones'],
  toggleGroup: (groupId) =>
    set((s) => ({
      expandedGroups: s.expandedGroups.includes(groupId)
        ? s.expandedGroups.filter((g) => g !== groupId)
        : [...s.expandedGroups, groupId],
    })),

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
  // Stats fetch is blocking (drives loading screen); health fetch is non-blocking (background).
  // Minimum splash duration: 4 seconds (visual sequence must complete).
  initialize: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    const splashStart = Date.now();

    // Step 1: Fetch stats (blocking — controls loading screen)
    try {
      const statsResponse = await fetchWithTimeout('/api/stats', { timeoutMs: FETCH_TIMEOUT });
      if (statsResponse.ok) {
        const json = await statsResponse.json();
        // Ensure minimum splash duration of 4 seconds
        const elapsed = Date.now() - splashStart;
        const remaining = Math.max(0, 4500 - elapsed);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        set({ data: json, loading: false, error: '' });
      } else {
        const elapsed = Date.now() - splashStart;
        const remaining = Math.max(0, 4500 - elapsed);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        set({ error: 'Error al cargar datos del dashboard', loading: false });
      }
    } catch (err) {
      const elapsed = Date.now() - splashStart;
      const remaining = Math.max(0, 3500 - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      set({
        error: err instanceof Error ? err.message : 'Error de conexion',
        loading: false,
      });
    }

    // Step 2: Fetch medios health in the background (non-blocking)
    fetchWithTimeout('/api/medios/health', { timeoutMs: FETCH_TIMEOUT })
      .then((res) => {
        if (res.ok) return res.json();
      })
      .then((json) => {
        if (json) set({ mediosHealth: json });
      })
      .catch(() => { /* silent — non-critical */ });
  },
}));
