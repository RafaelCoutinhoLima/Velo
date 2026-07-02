// Contrato de tema do Velo. Toda tela/componente que precise de cores,
// sombras ou presets tipográficos consome via `useTheme()` — os tokens neutros
// (Spacing, Radii, FontSize, FontWeight, Tracking, Fonts) seguem como exports
// estáticos em `lib/theme.ts`, pois não mudam entre identidades visuais.
import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeName = 'veloLight' | 'veloDark';

// Zonas de treino (modelo de 5 zonas) — cor é linguagem central do app.
// Regra de acessibilidade: cor nunca é o único rótulo (sempre código + nome).
export type ZoneCode = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export interface ZonePalette {
  color: string; // cor cheia (barras, pontos, badges)
  soft: string; // fundo tingido (chips de data, rep work, calendário)
}

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
  successBorder: string;
  warning: string;
  warningLight: string;
  warningBorder: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  purple: string; // ATL / cross-training
  purpleLight: string;
  gold: string; // badge "Recorde pessoal"
  // Neutros / superfícies
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string; // no escuro, elevação = superfície mais clara
  chip: string;
  border: string;
  borderStrong: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Zonas de treino Z1–Z5
  zones: Record<ZoneCode, ZonePalette>;
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
