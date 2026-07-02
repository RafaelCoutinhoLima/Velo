// Identidade Velo — tema claro (default). Fonte da verdade: handoff
// "Velo — Nova identidade visual" (Velo App.dc.html). Base azul confiável
// sobre off-white azulado; cards com borda e sem sombra (sombra só em hero e
// CTA); Hanken Grotesk para display, Inter para UI e JetBrains Mono para todo
// número tabular.
import { FontWeight, Fonts } from '../theme.tokens';
import type { Theme, ThemeType } from './types';

const colors = {
  primary: '#2a5ea7', // accent da marca — ações, seleção
  primaryLight: '#aac7ff',
  primaryMuted: '#e8f0fe', // accentSoft — fundo de destaque azul
  accent: '#3e90ff', // info — gráficos secundários, dados
  accentLight: '#d6e3ff',
  success: '#2f9e6f',
  successLight: '#e6f5ee',
  successBorder: '#b6e0cd',
  warning: '#ff8b00',
  warningLight: '#fff4e5',
  warningBorder: '#ffd9a8',
  danger: '#de350b',
  dangerLight: '#ffebe6',
  info: '#3e90ff',
  infoLight: '#e8f0fe',
  purple: '#5e4db2',
  purpleLight: '#edeafb',
  gold: '#ffd76a',
  bg: '#f5f8fd',
  surface: '#ffffff',
  surfaceAlt: '#eef2fa',
  surfaceElevated: '#ffffff',
  chip: '#eef2fa',
  border: '#d6e3ff',
  borderStrong: '#aac7ff',
  divider: '#e0e8f4',
  textPrimary: '#001b3e',
  textSecondary: '#565f71',
  textMuted: '#8a94a6',
  zones: {
    Z1: { color: '#7f97b8', soft: '#eef2fa' }, // Recuperação
    Z2: { color: '#2f9e6f', soft: '#e6f5ee' }, // Base aeróbica
    Z3: { color: '#d99a1c', soft: '#fff4e5' }, // Tempo
    Z4: { color: '#ef6c2a', soft: '#fdece2' }, // Limiar
    Z5: { color: '#de350b', soft: '#ffebe6' }, // VO₂máx
  },
  workoutEasy: '#2f9e6f',
  workoutInterval: '#ef6c2a',
  workoutTempo: '#d99a1c',
  workoutLong: '#3e90ff',
  workoutRest: '#7f97b8',
  workoutCross: '#5e4db2',
  onAccent: '#ffffff',
} as const;

// Tipografia compartilhada entre claro e escuro — só as cores mudam.
export const veloType: ThemeType = {
  // Títulos de tela: Hanken 800, 26–33px, tracking −0.6 a −0.8
  display: {
    fontFamily: Fonts.displayBlack,
    fontSize: 30,
    fontWeight: FontWeight.extrabold,
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  headline: {
    fontFamily: Fonts.displayBlack,
    fontSize: 26,
    fontWeight: FontWeight.extrabold,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    fontWeight: FontWeight.semibold,
    lineHeight: 23,
  },
  subtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    fontWeight: FontWeight.medium,
    lineHeight: 21,
  },
  // Corpo 13–15.5px, lh 1.45–1.55
  body: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontWeight: FontWeight.regular,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    lineHeight: 22,
  },
  bodySm: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: FontWeight.regular,
    lineHeight: 19,
  },
  // Rótulos uppercase 10–11px, tracking 0.8–1.4
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  // TODO número tabular em mono: pace, FC, km, rTSS, datas, badges de zona
  data: {
    fontFamily: Fonts.dataSemiBold,
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  dataLg: {
    fontFamily: Fonts.dataBold,
    fontSize: 23,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
};

export const veloLight: Theme = {
  name: 'veloLight',
  displayName: 'Claro',
  statusBar: 'dark',
  colors,
  // Sombra só em destaque — cards comuns: borda, sem sombra.
  shadow: {
    card: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Hero: 0 10px 28px rgba(42,94,167,0.16)
    elevated: {
      shadowColor: '#2a5ea7',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 8,
    },
    // CTA: 0 6px 18px rgba(42,94,167,0.28)
    glow: {
      shadowColor: '#2a5ea7',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
      elevation: 6,
    },
  },
  type: veloType,
};
