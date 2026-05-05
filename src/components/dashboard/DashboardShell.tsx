'use client';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { NAV_ITEMS, NAV_GROUPS, getNavLabel } from '@/constants/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { AlertCircle, Menu, X, Globe, ChevronDown, ChevronRight, MonitorPlay } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
export { LoadingScreen } from './LoadingScreen';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  // Fine-grained selectors
  const activeView = useDashboardStore((s) => s.activeView);
  const sidebarOpen = useDashboardStore((s) => s.sidebarOpen);
  const setSidebarOpen = useDashboardStore((s) => s.setSidebarOpen);
  const setActiveView = useDashboardStore((s) => s.setActiveView);
  const error = useDashboardStore((s) => s.error);
  const clearError = useDashboardStore((s) => s.clearError);
  const expandedGroups = useDashboardStore((s) => s.expandedGroups);
  const toggleGroup = useDashboardStore((s) => s.toggleGroup);

  // Current view label (supports nested items)
  const currentLabel = useMemo(() => getNavLabel(activeView), [activeView]);

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
            <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: '#0F2027' }}>
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

          {/* Nav with collapsible groups */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto custom-scrollbar">
            {NAV_GROUPS.map((group) => {
              const isGroupExpanded = expandedGroups.includes(group.id);
              return (
                <div key={group.id} className="mb-2 last:mb-0">
                  {/* Group header (clickable to collapse/expand) */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-3 mb-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30 transition-colors"
                  >
                    <span className="flex-1 text-left">{group.label}</span>
                    {isGroupExpanded
                      ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                      : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                    }
                  </button>

                  {/* Group items (hidden when collapsed) */}
                  {isGroupExpanded && (
                    <div className="space-y-0.5">
                  {NAV_ITEMS.slice(group.from, group.to + 1).map((item) => {
                    const hasChildren = item.children && item.children.length > 0;
                    const isExpanded = expandedGroups.includes(item.id);
                    const isActive = activeView === item.id;
                    const isChildActive = hasChildren && item.children!.some(c => c.id === activeView);

                    return (
                      <div key={item.id}>
                        {/* Main item */}
                        <button
                          onClick={() => {
                            if (hasChildren) {
                              toggleGroup(item.id);
                              // Also navigate to parent if clicking on collapsed
                              if (!isExpanded) setActiveView(item.id);
                            } else {
                              setActiveView(item.id);
                            }
                          }}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                            transition-colors duration-150
                            ${isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : isChildActive
                                ? 'bg-sidebar-accent/40 text-sidebar-accent-foreground'
                                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                            }
                          `}
                        >
                          {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {hasChildren && (
                            isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                              : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          )}
                        </button>

                        {/* Sub-items (collapsible) */}
                        {hasChildren && isExpanded && (
                          <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-0.5 mb-1">
                            {item.children!.map((child) => {
                              const isChildItemActive = activeView === child.id;
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => setActiveView(child.id)}
                                  className={`
                                    w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                                    transition-colors duration-150
                                    ${isChildItemActive
                                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/90'
                                    }
                                  `}
                                >
                                  {child.icon && <child.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                                  <span className="truncate">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                    </div>
                  )}
                </div>
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
            <Link
              href="/"
              onClick={() => setActiveView('preview')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mt-0.5"
            >
              <MonitorPlay className="h-4 w-4 shrink-0" />
              Vista Preview
            </Link>
            <div className="mt-2 px-3">
              <p className="text-[10px] text-sidebar-foreground/40">DECODEX &middot; ONION200 &middot; Bolivia</p>
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
                {currentLabel}
              </span>
            </div>
            {/* Right: status + actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(18,132,186,0.1)' }}>
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#1284BA' }} />
                <span className="text-[10px] font-medium hidden sm:inline" style={{ color: '#1284BA' }}>En línea</span>
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

        {/* Bottom branding bar */}
        <div className="border-t border-border bg-card/60 px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#0F2027' }}>
              <Image src="/logo.png" alt="DECODEX" width={20} height={20} className="object-cover" />
            </div>
            <span className="text-[11px] font-bold text-foreground/80 tracking-tight">DECODEX BOLIVIA</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 tracking-wide uppercase">Inteligencia de Señales</span>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: '#0F2027' }}>
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
