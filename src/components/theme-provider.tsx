'use client';

import * as React from 'react';

/**
 * ThemeProvider — iframe-safe wrapper.
 * En el sandbox de Z.ai, localStorage lanza SecurityError.
 * next-themes lo usa internamente, así que lo envolvemos con error boundary.
 * Si falla, renderiza children sin tema (usa CSS variables del :root).
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
  const [theme, setThemeState] = React.useState(props.defaultTheme || 'dark');
  const [mounted, setMounted] = React.useState(false);
  const [safe, setSafe] = React.useState(true);

  React.useEffect(() => {
    // Test if localStorage is accessible (iframe sandbox check)
    try {
      const test = '__theme_test__';
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
    } catch {
      // localStorage blocked — use simple class-based theming without next-themes
      setSafe(false);
    }
    setMounted(true);
  }, []);

  // Safe theme setter — applies class to <html> directly
  const setTheme = React.useCallback((t: string) => {
    setThemeState(t);
    try {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(t);
    } catch { /* silent */ }
  }, []);

  // On mount, apply theme class to <html>
  React.useEffect(() => {
    if (mounted) {
      try {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
      } catch { /* silent */ }
    }
  }, [mounted, theme]);

  // If localStorage works and next-themes is available, we could use it
  // But for iframe safety, we use our own simple implementation
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
