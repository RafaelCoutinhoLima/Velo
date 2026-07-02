// Seletor de identidade (tela 11): a cor de ação do app pode ser Azul
// (default), Verde ou Laranja. O accent troca `primary` (+ derivados e
// sombras coloridas) por cima do tema claro/escuro — o restante da paleta
// (zonas, semânticos, neutros) não muda.
import type { Theme } from './types';

export type AccentName = 'azul' | 'verde' | 'laranja';

export const ACCENTS: Record<AccentName, { displayName: string; light: string; dark: string }> = {
  azul: { displayName: 'Azul', light: '#2a5ea7', dark: '#5b95f7' },
  verde: { displayName: 'Verde', light: '#1f8a5b', dark: '#35b57f' },
  laranja: { displayName: 'Laranja', light: '#e0632a', dark: '#ffa245' },
};

export function applyAccent(base: Theme, name: AccentName): Theme {
  if (name === 'azul') return base; // os temas já nascem azuis

  const isLight = base.name === 'veloLight';
  const hex = isLight ? ACCENTS[name].light : ACCENTS[name].dark;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: hex,
      primaryLight: `${hex}40`, // ~25% — chips/anéis
      primaryMuted: `${hex}14`, // ~8% — accentSoft (canvas usa A+'10')
    },
    shadow: {
      ...base.shadow,
      // No escuro a elevação continua sem sombra; só o glow muda de cor.
      elevated: isLight ? { ...base.shadow.elevated, shadowColor: hex } : base.shadow.elevated,
      glow: { ...base.shadow.glow, shadowColor: hex },
    },
  };
}
