// Identidade Velo — tema escuro (grafite neutro, NÃO navy). Derivado
// mecanicamente dos tokens dark do handoff: elevação vira superfície mais
// clara (sombras somem), cards de destaque coloridos usam rgba(cor, 0.10–0.12)
// de fundo + rgba(cor, 0.3–0.4) de borda; único glow permitido é o CTA/hero
// accent rgba(91,149,247,0.3). Texto sobre accent é escuro (#101113).
import type { Theme } from './types';
import { veloType } from './veloLight';

const colors = {
  primary: '#5b95f7',
  primaryLight: 'rgba(91,149,247,0.18)',
  primaryMuted: 'rgba(91,149,247,0.12)',
  accent: '#6aa6ff',
  accentLight: 'rgba(106,166,255,0.16)',
  success: '#35b57f',
  successLight: 'rgba(53,181,127,0.12)',
  successBorder: 'rgba(53,181,127,0.38)',
  warning: '#ffa245',
  warningLight: 'rgba(255,162,69,0.12)',
  warningBorder: 'rgba(255,162,69,0.38)',
  danger: '#f0563d',
  dangerLight: 'rgba(240,86,61,0.12)',
  info: '#6aa6ff',
  infoLight: 'rgba(106,166,255,0.12)',
  purple: '#9b8cf0',
  purpleLight: 'rgba(155,140,240,0.12)',
  gold: '#ffd76a',
  bg: '#101113',
  surface: '#1a1c1f',
  surfaceAlt: '#141518',
  surfaceElevated: '#1e2024',
  chip: '#141518',
  border: '#2b2e34',
  borderStrong: '#3a3f47',
  divider: '#25282d',
  textPrimary: '#f2f4f6',
  textSecondary: '#b8bdc6',
  textMuted: '#8b9098',
  zones: {
    Z1: { color: '#828b99', soft: 'rgba(130,139,153,0.14)' }, // Recuperação
    Z2: { color: '#35b57f', soft: 'rgba(53,181,127,0.12)' }, // Base aeróbica
    Z3: { color: '#e0a63a', soft: 'rgba(224,166,58,0.12)' }, // Tempo
    Z4: { color: '#f5824a', soft: 'rgba(245,130,74,0.12)' }, // Limiar
    Z5: { color: '#f0563d', soft: 'rgba(240,86,61,0.12)' }, // VO₂máx
  },
  workoutEasy: '#35b57f',
  workoutInterval: '#f5824a',
  workoutTempo: '#e0a63a',
  workoutLong: '#6aa6ff',
  workoutRest: '#828b99',
  workoutCross: '#9b8cf0',
  onAccent: '#101113',
} as const;

export const veloDark: Theme = {
  name: 'veloDark',
  displayName: 'Escuro',
  statusBar: 'light',
  colors,
  shadow: {
    card: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    elevated: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Único glow permitido: CTA/hero accent rgba(91,149,247,0.3)
    glow: {
      shadowColor: '#5b95f7',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 18,
      elevation: 6,
    },
  },
  type: veloType,
};
