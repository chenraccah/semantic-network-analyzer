import React, { createContext, useContext } from 'react';

type Theme = 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Always light mode - ensure DOM is set correctly
if (typeof window !== 'undefined') {
  const root = document.documentElement;
  const body = document.body;
  root.classList.remove('dark');
  body.classList.remove('dark');
  root.style.colorScheme = 'light';
  root.style.backgroundColor = '#ffffff';
  body.style.backgroundColor = '';
  localStorage.removeItem('theme');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: Theme = 'light';
  const toggleTheme = () => {}; // No-op
  const setTheme = () => {}; // No-op

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
