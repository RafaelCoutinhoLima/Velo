import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

export function CalibrationBanner() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="flask" size={20} color={theme.colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Modo calibração</Text>
        <Text style={styles.text}>
          Estamos aprendendo seu corpo. Daqui ~2 semanas o plano fica mais agressivo.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.colors.accentLight,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    title: { ...theme.type.bodyStrong, color: theme.colors.accent },
    text: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });
