// Contrato de tema do FitSync AI. Toda tela/componente que precise de cores,
// sombras ou presets tipográficos consome via `useTheme()` — os tokens neutros
// (Spacing, Radii, FontSize, FontWeight, Tracking, Fonts) seguem como exports
// estáticos em `lib/theme.ts`, pois não mudam entre identidades visuais.
import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeName = 'interstellar' | 'interspaceBlue';

export interface ThemeColors {
  // Ação principal (botões, links, foco)
  primary: string;
  primaryLight: string; // surface sobre a qual texto primary se lê bem (chips)
  primaryMuted: string; // superfície tingida discretamente (why-card, badge)
  // Marca / dados (gráficos, métricas, ícones de destaque)
  accent: string;
  accentLight: string;
  // Semânticos
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  // Neutros / superfícies
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Sinalização por cor para tipos de treino
  workoutEasy: string;
  workoutInterval: string;
  workoutTempo: string;
  workoutLong: string;
  workoutRest: string;
  workoutCross: string;
  // Texto sobre superfície "primary" cheia
  onAccent: string;
}

export interface ThemeShadow {
  card: ViewStyle;
  elevated: ViewStyle;
  glow: ViewStyle;
}

export interface ThemeType {
  display: TextStyle;
  headline: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  bodyStrong: TextStyle;
  bodySm: TextStyle;
  label: TextStyle;
  data: TextStyle;
  dataLg: TextStyle;
}

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
  shadow: ThemeShadow;
  type: ThemeType;
  statusBar: 'light' | 'dark';
}
