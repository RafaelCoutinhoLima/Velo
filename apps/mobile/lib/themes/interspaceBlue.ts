// Identidade "Interspace Blue" (Google Stitch).
// Estética: tech-forward, energética. Mesma base azul que Interstellar mas
// com uso mais agressivo do azul: fundo levemente azulado, surfaces com tint
// azul, ícones/badges em azul saturado, headlines em peso 600 (semibold) com
// letterSpacing leve — visual mais "produto SaaS moderno".
import { FontSize, FontWeight, Fonts, Tracking } from '../theme.tokens';
import type { Theme } from './types';

const colors = {
  primary: '#2a5ea7', // azul saturado dominante
  primaryLight: '#aac7ff',
  primaryMuted: '#e8f0fe',
  accent: '#3e90ff', // azul brilhante secundário (dados, destaques)
  accentLight: '#d6e3ff',
  success: '#00875a',
  successLight: '#e3fcef',
  warning: '#ff8b00',
  warningLight: '#fff4e5',
  danger: '#de350b',
  dangerLight: '#ffebe6',
  bg: '#f5f8fd', // off-white com leve tint azul — vibe "interface tech"
  surface: '#ffffff',
  surfaceAlt: '#eef2fa',
  border: '#d6e3ff', // borda azul claro — mais "produto azul"
  borderStrong: '#aac7ff',
  textPrimary: '#001b3e', // azul-preto muito escuro
  textSecondary: '#00458d',
  textMuted: '#565f71',
  workoutEasy: '#00875a',
  workoutInterval: '#de350b',
  workoutTempo: '#ff8b00',
  workoutLong: '#0747a6',
  workoutRest: '#565f71',
  workoutCross: '#5e4db2',
  onAccent: '#ffffff',
} as const;

export const interspaceBlue: Theme = {
  name: 'interspaceBlue',
  displayName: 'Interspace Blue',
  statusBar: 'dark',
  colors,
  shadow: {
    card: {
      shadowColor: '#0a3a7a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#0a3a7a',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 8,
    },
    glow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 5,
    },
  },
  // Type: Inter dominante (sem Hanken). Pesos mais leves (semibold em vez de
  // extrabold) — vibe "techy" sem ser pesado. Mantém Hanken pro display hero
  // só pra título de tela (a única exceção), e JetBrains Mono pras métricas.
  type: {
    display: {
      fontFamily: Fonts.display,
      fontSize: FontSize['4xl'],
      fontWeight: FontWeight.bold,
      lineHeight: 42,
      letterSpacing: Tracking.tight,
    },
    headline: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize['2xl'],
      fontWeight: FontWeight.semibold,
      lineHeight: 32,
      letterSpacing: Tracking.tight,
    },
    title: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.semibold,
      lineHeight: 28,
    },
    subtitle: {
      fontFamily: Fonts.bodyMedium,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.medium,
      lineHeight: 24,
    },
    body: {
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      fontWeight: FontWeight.regular,
      lineHeight: 24,
    },
    bodyStrong: {
      fontFamily: Fonts.bodyMedium,
      fontSize: FontSize.md,
      fontWeight: FontWeight.medium,
      lineHeight: 24,
    },
    bodySm: {
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.regular,
      lineHeight: 20,
    },
    label: {
      fontFamily: Fonts.bodyMedium,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.medium,
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
