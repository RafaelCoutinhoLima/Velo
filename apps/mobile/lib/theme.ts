// FitSync AI — Design System "Kinetic Precision" (Google Stitch)
// Tema escuro de alta performance: fundo slate-black, dados em destaque,
// lima neon como cor de ação + azul elétrico como cor de marca/dados.
// Nomes de tokens estáveis (todas as telas dependem destes) — só os VALORES
// mudam. Tokens novos são aditivos e seguros.

export const Colors = {
  // Cor de ação (lima neon) — CTAs, progresso, estados "ativos"
  primary: '#C3F400',
  primaryLight: '#D4FF4D',
  primaryMuted: '#1E2A07', // superfície escura tingida de lima (badges/why-card)
  // Cor de marca / dados (azul elétrico) — branding, links, métricas, foco
  accent: '#3E90FF',
  accentLight: '#0E1F33',
  // Semânticos (vibrantes sobre dark)
  success: '#3DDC84',
  successLight: '#0E2A1B',
  warning: '#F5A623',
  warningLight: '#2A1F0A',
  danger: '#FF5C5C',
  dangerLight: '#2A1212',
  // Neutros (base slate-black — escala tonal do Stitch)
  bg: '#101415',
  surface: '#1D2022', // surface-container: cards
  surfaceAlt: '#272A2C', // surface-container-high: elevado, modais, sheets
  border: '#2F3437',
  borderStrong: '#414754',
  textPrimary: '#E0E3E5',
  textSecondary: '#AEB6BF',
  textMuted: '#7B8290',
  // Tipos de treino (sinalização por cor)
  workoutEasy: '#3DDC84',
  workoutInterval: '#FF5C5C',
  workoutTempo: '#F5A623',
  workoutLong: '#5B8DEF',
  workoutRest: '#7B8290',
  workoutCross: '#A98BFF',
  // Texto sobre superfícies de accent (lima/azul claros → texto escuro)
  onAccent: '#101415',
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
    shadowColor: '#C3F400',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// Famílias tipográficas do Stitch "Kinetic Precision". Os valores batem com
// os nomes das fontes carregadas via expo-font no _layout.tsx raiz. Enquanto
// as fontes não carregam (ou na web sem fallback), o RN usa a fonte do
// sistema — seguro. Use `Fonts.data` para números que atualizam em tempo
// real (monoespaçada evita "pulo" horizontal).
export const Fonts = {
  display: 'HankenGrotesk-Bold', // headlines / títulos — geometria técnica
  displayBlack: 'HankenGrotesk-ExtraBold', // display-lg (hero, uppercase)
  body: 'Inter-Regular', // texto corrido / instruções
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  bodyBold: 'Inter-Bold',
  data: 'JetBrainsMono-Medium', // métricas (pace, FC, splits)
} as const;

// Escala tipográfica do Stitch "Kinetic Precision". Presets prontos para
// espalhar em <Text style={Type.headline}> — já trazem família + tamanho +
// peso + entrelinha + tracking corretos. `fontWeight` fica junto como
// fallback para quando a fonte custom não carregar.
export const Type = {
  // Hero uppercase — títulos de tela (ex.: "RODAGEM LEVE")
  display: {
    fontFamily: Fonts.displayBlack,
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.extrabold,
    lineHeight: 40,
    letterSpacing: Tracking.tight,
  },
  // Título de seção grande
  headline: {
    fontFamily: Fonts.display,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    lineHeight: 30,
    letterSpacing: Tracking.tight,
  },
  // Título de card
  title: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: 26,
  },
  // Subtítulo / título de linha
  subtitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    lineHeight: 24,
  },
  // Texto corrido
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
  // Texto secundário menor
  bodySm: {
    fontFamily: Fonts.body,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: 19,
  },
  // Eyebrow / label uppercase de seção
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: Tracking.wide,
    textTransform: 'uppercase' as const,
  },
  // Métrica monoespaçada (pace, FC, splits)
  data: {
    fontFamily: Fonts.data,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'] as const,
  },
  // Métrica grande em destaque
  dataLg: {
    fontFamily: Fonts.data,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;
