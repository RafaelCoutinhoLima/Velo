import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

export function CalibrationDoneNotice({ onDismiss }: { onDismiss: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={styles.notice}
      onPress={onDismiss}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Calibração concluída. Toque para dispensar."
    >
      <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Calibração concluída</Text>
        <Text style={styles.text}>
          Já conhecemos seu condicionamento, seu plano agora progride normalmente.
        </Text>
      </View>
      <Ionicons name="close" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: theme.colors.successLight,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    title: { ...theme.type.bodyStrong, color: theme.colors.success },
    text: {
      ...theme.type.bodySm,
      fontSize: FontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });
