'use client';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { NAV_ITEMS, NAV_GROUPS, getNavLabel } from '@/constants/nav';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  AlertCircle, Menu, X, Globe, ChevronDown, ChevronRight,
  MonitorPlay, BarChart3, Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useCallback } from 'react';
export { LoadingScreen } from './LoadingScreen';

// ─── Active indicator bar ─────────────────────────────────
// Thin left accent bar that shows which section is active

function ActiveBar() {
  return (
    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
  );
}

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

  // Check if any child of a parent item is active
  const isChildActive = useCallback((item: typeof NAV_ITEMS[number]): boolean => {
    return item.children?.some(c => c.id === activeView) || false;
  }, [activeView]);

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

          {/* ═══ NAVIGATION ═══ */}
          <nav className="flex-1 px-3 py-3 overflow-y-auto custom-scrollbar">

            {/* ── CENTRO DE COMANDO (always visible) ── */}
            <div className="mb-3">
              <button
                onClick={() => setActiveView('resumen')}
                className={`
                  relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold
                  transition-all duration-150
                  ${activeView === 'resumen'
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }
                `}
              >
                {/* Active indicator — always on top-level main button */}
                {activeView === 'resumen' && <ActiveBar />}

                <div className={`flex items-center justify-center h-5 w-5 rounded-md shrink-0 ${activeView === 'resumen' ? 'bg-primary/20' : ''}`}>
                  <BarChart3 className="h-4 w-4" />
                </div>
                <span className="flex-1 text-left truncate">Centro de Comando</span>

                {/* Pulse dot for active */}
                {activeView === 'resumen' && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="mx-3 mb-3 border-t border-sidebar-border/60" />

            {/* ── GROUPS (collapsible) ── */}
            {NAV_GROUPS.map((group) => {
              const isGroupExpanded = expandedGroups.includes(group.id);
              // Check if any item in this group or its children is active
              const isGroupActive = NAV_ITEMS.slice(group.from, group.to + 1).some(
                item => item.id === activeView || item.children?.some(c => c.id === activeView)
              );
              const isProminent = group.prominent;
              const groupColor = group.color || '#888';

              // Skip resumen in analisis group — rendered above
              const groupItems = group.id === 'analisis'
                ? NAV_ITEMS.slice(group.from + 1, group.to + 1)
                : NAV_ITEMS.slice(group.from, group.to + 1);

              return (
                <div key={group.id} className={isProminent ? 'mb-1 mt-3' : 'mb-1.5'}>
                  {/* ── Prominent Group Header ── */}
                  {isProminent && (
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 mb-1 py-2.5 rounded-lg
                        border-l-[3px] transition-all duration-150
                        ${isGroupActive
                          ? 'shadow-md'
                          : 'hover:bg-sidebar-accent/30'
                        }
                      `}
                      style={{
                        borderLeftColor: groupColor,
                        backgroundColor: isGroupActive ? `${groupColor}18` : `${groupColor}08`,
                      }}
                    >
                      {/* Icon box */}
                      {group.icon && (
                        <div
                          className="flex items-center justify-center h-6 w-6 rounded-md shrink-0"
                          style={{ backgroundColor: isGroupActive ? `${groupColor}30` : `${groupColor}15` }}
                        >
                          <group.icon className="h-4 w-4" style={{ color: groupColor }} />
                        </div>
                      )}
                      <span
                        className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: isGroupActive ? groupColor : `${groupColor}CC` }}
                      >
                        {group.label}
                      </span>
                      {/* Active: pulsing dot */}
                      {isGroupActive && (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: `${groupColor}80` }} />
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: groupColor }} />
                        </span>
                      )}
                      {/* Chevron */}
                      {isGroupExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      }
                    </button>
                  )}

                  {/* ── Standard (non-prominent) Group Header ── */}
                  {!isProminent && (
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`
                        w-full flex items-center gap-2 px-3 mb-1 py-1 rounded-md
                        text-[10px] font-bold uppercase tracking-widest
                        transition-colors
                        ${isGroupActive
                          ? 'text-primary/80'
                          : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70'
                        }
                      `}
                    >
                      {isGroupActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <span className="flex-1 text-left">{group.label}</span>
                      {isGroupExpanded
                        ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                        : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                      }
                    </button>
                  )}

                  {/* ── Group Items ── */}
                  {isGroupExpanded && (
                    <div className="space-y-0.5 mb-1">
                      {groupItems.map((item) => {
                        const hasChildren = item.children && item.children.length > 0;
                        const isExpanded = expandedGroups.includes(item.id);
                        const isActive = activeView === item.id;
                        const childActive = isChildActive(item);

                        // Prominent groups: use group color for active items
                        const activeBg = isProminent ? `${groupColor}15` : 'bg-primary/10';
                        const activeText = isProminent ? '' : 'text-primary';
                        const activeIconBg = isProminent ? `${groupColor}25` : 'bg-primary/20';
                        const barColor = isProminent ? groupColor : undefined;
                        const dotColor = isProminent ? groupColor : undefined;

                        return (
                          <div key={item.id}>
                            {/* Main item */}
                            <button
                              onClick={() => {
                                if (hasChildren) {
                                  toggleGroup(item.id);
                                  if (!isExpanded) setActiveView(item.id);
                                } else {
                                  setActiveView(item.id);
                                }
                              }}
                              className={`
                                relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                                transition-all duration-150
                                ${isActive
                                  ? 'shadow-sm'
                                  : childActive
                                    ? 'bg-sidebar-accent/50 text-sidebar-accent-foreground'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                }
                              `}
                              style={isActive ? {
                                backgroundColor: activeBg,
                                color: barColor || undefined,
                              } : undefined}
                            >
                              {/* Active indicator bar */}
                              {isActive && (
                                <span
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                                  style={{ backgroundColor: barColor || 'hsl(var(--primary))' }}
                                />
                              )}
                              {childActive && !isActive && (
                                <span
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-r-full opacity-50"
                                  style={{ backgroundColor: barColor || 'hsl(var(--primary))' }}
                                />
                              )}

                              {/* Icon in box when active, plain when not */}
                              <div
                                className="flex items-center justify-center h-5 w-5 rounded-md shrink-0"
                                style={isActive ? { backgroundColor: activeIconBg } : undefined}
                              >
                                {item.icon && <item.icon className={`h-4 w-4 ${isActive ? '' : 'opacity-70'}`} />}
                              </div>
                              <span className={`flex-1 text-left truncate ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>

                              {/* Active dot for leaf items */}
                              {isActive && !hasChildren && (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: `${dotColor}90` || 'hsl(var(--primary))' }} />
                                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: dotColor || 'hsl(var(--primary))' }} />
                                </span>
                              )}

                              {hasChildren && (
                                isExpanded
                                  ? <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-80' : 'opacity-50'}`} />
                                  : <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'opacity-80' : 'opacity-50'}`} />
                              )}
                            </button>

                            {/* Sub-items */}
                            {hasChildren && isExpanded && (
                              <div className="ml-3 mt-0.5 mb-1">
                                <div className="border-l-2 border-sidebar-border/40 pl-3 space-y-0.5">
                                  {item.children!.map((child) => {
                                    const isChildItemActive = activeView === child.id;
                                    return (
                                      <button
                                        key={child.id}
                                        onClick={() => setActiveView(child.id)}
                                        className={`
                                          relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                                          text-[11px] font-medium transition-all duration-150
                                          ${isChildItemActive
                                            ? ''
                                            : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/80'
                                          }
                                        `}
                                        style={isChildItemActive ? {
                                          backgroundColor: isProminent ? `${groupColor}12` : 'hsl(var(--primary) / 0.1)',
                                          color: barColor || 'hsl(var(--primary))',
                                        } : undefined}
                                      >
                                        {isChildItemActive && (
                                          <span
                                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-r-full"
                                            style={{ backgroundColor: barColor || 'hsl(var(--primary))' }}
                                          />
                                        )}

                                        {child.icon && <child.icon className={`h-3 w-3 shrink-0 ${isChildItemActive ? '' : 'opacity-50'}`} />}
                                        <span className="truncate">{child.label}</span>

                                        {isChildItemActive && (
                                          <span
                                            className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: barColor || 'hsl(var(--primary))' }}
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
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
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <Globe className="h-4 w-4 shrink-0" />
              Vista cliente
            </Link>
            <Link
              href="/"
              onClick={() => setActiveView('preview')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mt-0.5"
            >
              <MonitorPlay className="h-4 w-4 shrink-0" />
              Vista Preview
            </Link>
            <div className="mt-2 px-3">
              <p className="text-[10px] text-sidebar-foreground/30">DECODEX &middot; ONION200 &middot; Bolivia</p>
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
              <div className="flex items-center gap-2">
                {/* Quick return to command center */}
                {activeView !== 'resumen' && (
                  <button
                    onClick={() => setActiveView('resumen')}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    title="Volver al Centro de Comando"
                  >
                    <Zap className="h-3 w-3" />
                    <span className="hidden sm:inline">Comando</span>
                  </button>
                )}
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {currentLabel}
                </span>
              </div>
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
