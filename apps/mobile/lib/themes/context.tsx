// ThemeProvider + hook useTheme. O tema ativo vem do zustand store
// (persistido), então a escolha do usuário sobrevive a restarts. A troca via
// `setThemeName()` é instantânea — todos os `useTheme()` consumidores re-
// renderizam (e seus `useMemo(() => createStyles(theme))` recalculam).
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { usePrefsStore } from '../store';
import { veloLight } from './veloLight';
import { veloDark } from './veloDark';
import { ACCENTS, applyAccent, type AccentName } from './accents';
import type { Theme, ThemeName } from './types';

const THEMES: Record<ThemeName, Theme> = {
  veloLight,
  veloDark,
};

const AVAILABLE = [
  { name: 'veloLight' as ThemeName, displayName: veloLight.displayName },
  { name: 'veloDark' as ThemeName, displayName: veloDark.displayName },
];

const AVAILABLE_ACCENTS = (Object.keys(ACCENTS) as AccentName[]).map((name) => ({
  name,
  displayName: ACCENTS[name].displayName,
}));

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  accentName: AccentName;
  setThemeName: (name: ThemeName) => void;
  setAccentName: (name: AccentName) => void;
  available: { name: ThemeName; displayName: string }[];
  availableAccents: { name: AccentName; displayName: string }[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeName = usePrefsStore((s) => s.themeName);
  const accentName = usePrefsStore((s) => s.accentName);
  const setThemeName = usePrefsStore((s) => s.setThemeName);
  const setAccentName = usePrefsStore((s) => s.setAccentName);
  // Fallbacks cobrem valores antigos persistidos (interstellar/interspaceBlue).
  const base = THEMES[themeName] ?? veloLight;
  const accent: AccentName = ACCENTS[accentName] ? accentName : 'azul';
  const theme = useMemo(() => applyAccent(base, accent), [base, accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeName: theme.name,
      accentName: accent,
      setThemeName,
      setAccentName,
      available: AVAILABLE,
      availableAccents: AVAILABLE_ACCENTS,
    }),
    [theme, accent, setThemeName, setAccentName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro: telas montadas fora do provider (raríssimo, testes)
    // recebem o tema default sem quebrar. Setters viram no-op.
    return {
      theme: veloLight,
      themeName: 'veloLight',
      accentName: 'azul',
      setThemeName: () => {},
      setAccentName: () => {},
      available: AVAILABLE,
      availableAccents: AVAILABLE_ACCENTS,
    };
  }
  return ctx;
}
