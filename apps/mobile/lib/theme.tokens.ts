// Tokens neutros ao tema — não mudam quando o usuário troca de identidade
// visual. Spacing, Radii, FontSize, FontWeight e Tracking definem ritmo e
// hierarquia; só cores, sombras e presets tipográficos (Type) variam entre
// Interstellar e Interspace Blue (esses ficam em `lib/themes/*`).

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

export const Tracking = {
  tight: -0.5,
  normal: 0,
  wide: 1,
  wider: 1.5,
} as const;

// Famílias tipográficas carregadas via expo-font no _layout.tsx raiz.
export const Fonts = {
  display: 'HankenGrotesk-Bold',
  displayBlack: 'HankenGrotesk-ExtraBold',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  bodyBold: 'Inter-Bold',
  data: 'JetBrainsMono-Medium',
  dataSemiBold: 'JetBrainsMono-SemiBold',
  dataBold: 'JetBrainsMono-Bold',
} as const;
