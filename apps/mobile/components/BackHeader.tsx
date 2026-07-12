import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing, useTheme, type Theme } from '../lib/theme';

interface BackHeaderProps {
  onBack?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Header de tela de detalhe/fluxo: botão de voltar (44×44, alvo de toque
// mínimo) + slot opcional à direita (data, título). Anatomia repetida em
// 6+ telas (workout/[id], feedback/[id], plan/workout/[day], plan/new,
// onboarding/cooper, metrics) antes desta extração.
export function BackHeader({ onBack, right, style }: BackHeaderProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.header, right ? styles.headerSplit : null, style]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      {right}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xl + Spacing.xs,
      paddingBottom: Spacing.sm,
    },
    headerSplit: { justifyContent: 'space-between' },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: Radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
