import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Radii, Spacing, useTheme, type Theme } from '../lib/theme';

// Barra de topo do app: wordmark "Velo" (Hanken 800 + ponto accent na
// baseline) à esquerda, avatar à direita — anatomia da tela 04 do handoff.
export function TopBar() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmark}>Velo</Text>
        <View style={styles.wordmarkDot} />
      </View>
      <TouchableOpacity
        style={styles.avatar}
        onPress={() => router.navigate('/(tabs)/settings')}
        accessibilityRole="button"
        accessibilityLabel="Abrir configurações"
      >
        <Ionicons name="person" size={19} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md + 4,
      paddingTop: Spacing.xl + Spacing.xs,
      paddingBottom: Spacing.sm,
      backgroundColor: theme.colors.bg,
    },
    wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    wordmark: {
      fontFamily: Fonts.displayBlack,
      fontSize: 22,
      letterSpacing: -0.5,
      color: theme.colors.textPrimary,
    },
    wordmarkDot: {
      width: 7,
      height: 7,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.primary,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: Radii.full,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
