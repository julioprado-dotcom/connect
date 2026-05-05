'use client';

import { useSession, signOut } from 'next-auth/react';
import { LogOut, User, ChevronDown, Shield, Building } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  admin: {
    label: 'Administrador',
    icon: <Shield className="h-3 w-3" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  agente: {
    label: 'Agente',
    icon: <Building className="h-3 w-3" />,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  viewer: {
    label: 'Observador',
    icon: <User className="h-3 w-3" />,
    color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  },
};

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg',
        compact ? 'px-2 py-1' : 'px-3 py-2'
      )}>
        <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
        {!compact && <div className="h-4 w-20 rounded bg-muted animate-pulse" />}
      </div>
    );
  }

  // Not authenticated — show login link
  if (status === 'unauthenticated' || !session?.user) {
    return (
      <a
        href="/login"
        className={cn(
          'flex items-center gap-2 rounded-lg transition-colors',
          compact
            ? 'px-2 py-1 text-xs text-muted-foreground hover:text-foreground'
            : 'px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <User className="h-4 w-4" />
        {!compact && <span>Iniciar sesion</span>}
      </a>
    );
  }

  const user = session.user;
  const roleInfo = ROLE_LABELS[user.role || ''] || ROLE_LABELS.viewer;
  const initials = getInitials(user.name);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg transition-colors hover:bg-muted',
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
        )}
      >
        {/* Avatar */}
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ backgroundColor: '#0F2027' }}
        >
          {initials}
        </div>

        {/* Name + role (hidden on compact) */}
        {!compact && (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-left">
              <p className="text-xs font-medium text-foreground truncate max-w-[120px] leading-tight">
                {user.name || 'Usuario'}
              </p>
              <div className={cn('inline-flex items-center gap-1 px-1.5 py-0 rounded text-[9px] font-medium mt-0.5', roleInfo.color)}>
                {roleInfo.icon}
                {roleInfo.label}
              </div>
            </div>
            <ChevronDown className={cn(
              'h-3 w-3 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )} />
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* User info header */}
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-semibold text-foreground truncate">
              {user.name || 'Usuario'}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {user.email || ''}
            </p>
            <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium mt-1.5', roleInfo.color)}>
              {roleInfo.icon}
              {roleInfo.label}
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={async () => {
                setOpen(false);
                await signOut({ callbackUrl: '/' });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-lg mx-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
