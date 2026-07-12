import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts, FontSize, useTheme, type Theme } from '../../lib/theme';

export const RPE_LABELS: Record<number, string> = {
  1: 'Muito fácil', 2: 'Fácil', 3: 'Leve', 4: 'Moderado', 5: 'Razoável',
  6: 'Intenso', 7: 'Difícil', 8: 'Muito difícil', 9: 'Extenuante', 10: 'Máximo',
};

interface RpeScaleProps {
  value: number | null;
  onSelect: (value: number) => void;
  colorFor: (value: number) => string;
}

// Escala RPE (tela 31): grade de 10 células, selecionada com cor cheia +
// sombra da própria cor. Widget auto-contido — só emite `onSelect`, quem
// chama decide o que fazer com o valor (salvar, editar, etc.).
export function RpeScale({ value, onSelect, colorFor }: RpeScaleProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View>
      <View style={styles.rpeRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.rpeBtn,
              value === n && {
                backgroundColor: colorFor(n),
                borderColor: colorFor(n),
                ...theme.shadow.glow,
                shadowColor: colorFor(n),
              },
            ]}
            onPress={() => onSelect(n)}
            accessibilityRole="button"
            accessibilityLabel={`RPE ${n}: ${RPE_LABELS[n]}`}
            accessibilityState={{ selected: value === n }}
          >
            <Text style={[styles.rpeBtnText, value === n && styles.rpeBtnTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.rpeExtremes}>
        <Text style={styles.rpeExtremeText}>muito fácil</Text>
        <Text style={styles.rpeExtremeText}>máximo</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    rpeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    rpeBtn: {
      flexGrow: 1,
      flexBasis: '17%',
      aspectRatio: 0.82,
      maxHeight: 52,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    rpeBtnText: {
      fontFamily: Fonts.dataSemiBold,
      fontSize: FontSize.md,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    rpeBtnTextActive: { color: theme.colors.onAccent },
    rpeExtremes: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    rpeExtremeText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 10,
      color: theme.colors.textMuted,
    },
  });
