import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

export function CoachInsights({ text }: { text: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.banner}>
      <Ionicons name="star" size={18} color={theme.colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Leitura da semana</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      gap: Spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.md,
    },
    label: { ...theme.type.label, color: theme.colors.primary, marginBottom: 3 },
    text: { ...theme.type.bodySm, color: theme.colors.textPrimary },
  });
