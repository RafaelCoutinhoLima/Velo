// Identidade "Interstellar Light" (Google Stitch).
// Estética: corporate-modern, minimalista solar. Branco dominante, azul de
// confiança usado com moderação só em ações primárias e links. Tipografia
// Hanken Grotesk (display) + Inter (corpo) + JetBrains Mono (métricas);
// pesos cheios (700/800) para hierarquia clara.
import { FontSize, FontWeight, Fonts, Tracking } from '../theme.tokens';
import type { Theme } from './types';

const colors = {
  primary: '#4777c2', // Confidence Blue — CTAs, foco
  primaryLight: '#d6e3ff',
  primaryMuted: '#eef3fb',
  accent: '#2a5ea7', // Azul mais escuro — branding, dados
  accentLight: '#dae2f8',
  success: '#2e7d32',
  successLight: '#e6f4ea',
  warning: '#ed6c02',
  warningLight: '#fef3e6',
  danger: '#ba1a1a',
  dangerLight: '#fde8e8',
  bg: '#fbf9f9', // off-white — fundo solar
  surface: '#ffffff', // cards puramente brancos
  surfaceAlt: '#f5f3f3', // surface elevada/modal
  border: '#e3e2e2',
  borderStrong: '#c6c6c6',
  textPrimary: '#1b1c1c',
  textSecondary: '#474747',
  textMuted: '#777777',
  workoutEasy: '#2e7d32',
  workoutInterval: '#c62828',
  workoutTempo: '#ed6c02',
  workoutLong: '#2a5ea7',
  workoutRest: '#777777',
  workoutCross: '#6f5674',
  onAccent: '#ffffff',
} as const;

export const interstellar: Theme = {
  name: 'interstellar',
  displayName: 'Interstellar Light',
  statusBar: 'dark',
  colors,
  // Em light, profundidade vem de sombras suaves cinza (não preto puro).
  // `glow` não tem o brilho neon do dark — é um halo azul discreto.
  shadow: {
    card: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    elevated: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
    glow: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  type: {
    display: {
      fontFamily: Fonts.displayBlack,
      fontSize: FontSize['4xl'],
      fontWeight: FontWeight.extrabold,
      lineHeight: 40,
      letterSpacing: Tracking.tight,
    },
    headline: {
      fontFamily: Fonts.display,
      fontSize: FontSize['2xl'],
      fontWeight: FontWeight.bold,
      lineHeight: 30,
      letterSpacing: Tracking.tight,
    },
    title: {
      fontFamily: Fonts.display,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      lineHeight: 26,
    },
    subtitle: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      lineHeight: 24,
    },
    body: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.regular,
      lineHeight: 22,
    },
    bodyStrong: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.md,
      fontWeight: FontWeight.semibold,
      lineHeight: 22,
    },
    bodySm: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.regular,
      lineHeight: 19,
    },
    label: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      letterSpacing: Tracking.wide,
      textTransform: 'uppercase',
    },
    data: {
      fontFamily: Fonts.data,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
      fontVariant: ['tabular-nums'],
    },
    dataLg: {
      fontFamily: Fonts.data,
      fontSize: FontSize['3xl'],
      fontWeight: FontWeight.medium,
      fontVariant: ['tabular-nums'],
    },
  },
};
