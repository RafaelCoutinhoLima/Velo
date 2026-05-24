// ThemeProvider + hook useTheme. O tema ativo vem do zustand store
// (persistido), então a escolha do usuário sobrevive a restarts. A troca via
// `setThemeName()` é instantânea — todos os `useTheme()` consumidores re-
// renderizam (e seus `useMemo(() => createStyles(theme))` recalculam).
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePrefsStore } from '../store';
import { interstellar } from './interstellar';
import { interspaceBlue } from './interspaceBlue';
import type { Theme, ThemeName } from './types';

const THEMES: Record<ThemeName, Theme> = {
  interstellar,
  interspaceBlue,
};

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  available: { name: ThemeName; displayName: string }[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeName = usePrefsStore((s) => s.themeName);
  const setThemeName = usePrefsStore((s) => s.setThemeName);
  const theme = THEMES[themeName] ?? interstellar;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeName,
      setThemeName,
      available: [
        { name: 'interstellar', displayName: interstellar.displayName },
        { name: 'interspaceBlue', displayName: interspaceBlue.displayName },
      ],
    }),
    [theme, themeName, setThemeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro: telas montadas fora do provider (raríssimo, testes)
    // recebem o tema default sem quebrar. Setter vira no-op.
    return {
      theme: interstellar,
      themeName: 'interstellar',
      setThemeName: () => {},
      available: [
        { name: 'interstellar', displayName: interstellar.displayName },
        { name: 'interspaceBlue', displayName: interspaceBlue.displayName },
      ],
    };
  }
  return ctx;
}
