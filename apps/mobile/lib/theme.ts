// FitSync AI — Design System "Performance Dark"
// Tema escuro de alta performance: fundo quase-preto, dados em destaque,
// accent neon lima + cyan. Nomes de tokens estáveis (todas as telas dependem
// destes) — só os VALORES mudam. Tokens novos são aditivos e seguros.

export const Colors = {
  // Accent / marca (lima neon) — usado em CTAs e destaques de energia
  primary: '#C8FF3D',
  primaryLight: '#D6FF66',
  primaryMuted: '#1C2A12', // superfície escura tingida de lima (badges/why-card)
  // Accent secundário (cyan) — destaque de dados/métricas
  accent: '#38E1D6',
  accentLight: '#0E2A28',
  // Semânticos (vibrantes sobre dark)
  success: '#3DDC84',
  successLight: '#0E2A1B',
  warning: '#F5A623',
  warningLight: '#2A1F0A',
  danger: '#FF5C5C',
  dangerLight: '#2A1212',
  // Neutros (base dark)
  bg: '#0A0E14',
  surface: '#131A24',
  surfaceAlt: '#1B232F', // elevado: modais, sheets, estados ativos
  border: '#232C38',
  borderStrong: '#33414F',
  textPrimary: '#E8EDF2',
  textSecondary: '#9AA7B5',
  textMuted: '#5C6B7A',
  // Tipos de treino (sinalização por cor)
  workoutEasy: '#3DDC84',
  workoutInterval: '#FF5C5C',
  workoutTempo: '#F5A623',
  workoutLong: '#5B8DEF',
  workoutRest: '#5C6B7A',
  workoutCross: '#A98BFF',
  // Texto sobre superfícies de accent (lima/cyan são claros → texto escuro)
  onAccent: '#0A0E14',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 36,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// Espaçamento de letra — display apertado, labels/eyebrow largos (uppercase)
export const Tracking = {
  tight: -0.5,
  normal: 0,
  wide: 1,
  wider: 1.5,
} as const;

// Em dark a profundidade vem do contraste superfície/fundo + borda; a sombra
// preta quase não aparece, então usamos opacidade baixa só p/ separar camadas.
// `glow` dá o brilho neon do accent em CTAs/elementos de destaque.
export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    shadowColor: '#C8FF3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
