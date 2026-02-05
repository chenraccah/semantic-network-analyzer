import React, { createContext, useContext, useLayoutEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply theme to DOM immediately — can be called outside of React lifecycle */
function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  const body = document.body;

  // Toggle class on both html and body
  root.classList.toggle('dark', theme === 'dark');
  body.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);

  // Force the browser's color scheme to match our choice.
  // This prevents the browser / OS dark mode from overriding.
  root.style.colorScheme = theme;
  root.style.backgroundColor = theme === 'dark' ? '#111827' : '#ffffff';
  body.style.backgroundColor = theme === 'dark' ? '#111827' : '';

  // Update <meta name="color-scheme"> to lock the browser into our chosen scheme
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', theme);
  }

  localStorage.setItem('theme', theme);
}

// Apply initial theme immediately (before React renders)
applyThemeToDOM(getInitialTheme());

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Sync DOM on every theme change — useLayoutEffect ensures
  // changes are committed before the browser paints
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    applyThemeToDOM(t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyThemeToDOM(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
