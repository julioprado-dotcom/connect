'use client';

import * as React from 'react';

/**
 * ThemeProvider — iframe-safe wrapper con persistencia localStorage.
 * - Aplica clase 'dark'/'light' en <html>
 * - Persiste elección en localStorage para mantener entre recargas
 * - Sin dependencia de next-themes (iframe-safe)
 */
const ThemeContext = React.createContext<{
  theme: string;
  setTheme: (t: string) => void;
}>({ theme: 'dark', setTheme: () => {} });

export function useTheme() {
  return React.useContext(ThemeContext);
}

export function ThemeProvider({ children, ...props }: {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
}) {
  const defaultT = props.defaultTheme || 'dark';
  const [theme, setThemeState] = React.useState(defaultT);
  const [mounted, setMounted] = React.useState(false);

  // On mount: read persisted theme from localStorage, then apply class
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem('decodex-theme');
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyClass(stored);
      } else {
        applyClass(defaultT);
      }
    } catch {
      // localStorage blocked (iframe) — use default
      applyClass(defaultT);
    }
    setMounted(true);
  }, []);

  // Persist + apply theme
  const setTheme = React.useCallback((t: string) => {
    setThemeState(t);
    applyClass(t);
    try {
      window.localStorage.setItem('decodex-theme', t);
    } catch { /* silent — iframe */ }
  }, []);

  // Re-apply on theme state change (for controlled updates)
  React.useEffect(() => {
    if (mounted) {
      applyClass(theme);
    }
  }, [mounted, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyClass(t: string) {
  try {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(t);
  } catch { /* silent */ }
}
