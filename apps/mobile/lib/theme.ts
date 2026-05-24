// Ponto único de entrada do sistema de design. Tokens neutros (Spacing,
// Radii, FontSize, FontWeight, Tracking, Fonts) vêm de `./theme.tokens` e
// nunca mudam. Tokens dependentes de tema (Colors, Shadow, Type) só existem
// via `useTheme()` — não há mais exports estáticos para essas três famílias,
// pois mudariam com a identidade visual selecionada pelo usuário.
//
// Para ler cor/sombra/preset tipográfico em runtime:
//   const { theme } = useTheme();
//   <View style={{ backgroundColor: theme.colors.bg }} />
//
// Para criar StyleSheet dependente de tema, use o padrão:
//   const theme = useTheme().theme;
//   const styles = useMemo(() => createStyles(theme), [theme]);

export { Spacing, Radii, FontSize, FontWeight, Tracking, Fonts } from './theme.tokens';
export { ThemeProvider, useTheme } from './themes';
export type { Theme, ThemeColors, ThemeName, ThemeShadow, ThemeType } from './themes';
