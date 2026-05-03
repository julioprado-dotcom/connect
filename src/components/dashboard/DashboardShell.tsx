'use client';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { NAV_ITEMS } from '@/constants/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { AlertCircle, Menu, X, Globe } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  // Fine-grained selectors
  const activeView = useDashboardStore((s) => s.activeView);
  const sidebarOpen = useDashboardStore((s) => s.sidebarOpen);
  const setSidebarOpen = useDashboardStore((s) => s.setSidebarOpen);
  const setActiveView = useDashboardStore((s) => s.setActiveView);
  const error = useDashboardStore((s) => s.error);
  const clearError = useDashboardStore((s) => s.clearError);

  // Memoize current nav item lookup
  const currentNavItem = useMemo(
    () => NAV_ITEMS.find((n) => n.id === activeView),
    [activeView],
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Branding */}
          <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: '#0A1628' }}>
              <Image src="/logo.png" alt="DECODEX" width={32} height={32} className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-extrabold tracking-tight text-sidebar-foreground truncate leading-none">DECODEX BOLIVIA</h2>
              <p className="text-[9px] text-sidebar-foreground/60 mt-0.5 tracking-wide uppercase">Inteligencia de Señales</p>
            </div>
            <button
              className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-sidebar-border">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <Globe className="h-4 w-4 shrink-0" />
              Vista cliente
            </Link>
            <div className="mt-2 px-3">
              <p className="text-[10px] text-sidebar-foreground/40">DECODEX · ONION200 · Bolivia</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
            {/* Left: view name */}
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-1.5 rounded-lg hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {currentNavItem?.label || 'Centro de Comando'}
              </span>
            </div>
            {/* Right: status + actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hidden sm:inline">En línea</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 flex items-center justify-between text-red-700 dark:text-red-300 text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <button onClick={clearError} className="text-xs underline hover:no-underline">Cerrar</button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: '#0A1628' }}>
          <Image src="/logo.png" alt="DECODEX" width={48} height={48} className="object-cover" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">DECODEX</p>
          <p className="text-muted-foreground text-sm">Cargando dashboard...</p>
        </div>
      </div>
    </div>
  );
}
