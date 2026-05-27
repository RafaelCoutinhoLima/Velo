import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

interface MetricChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  tint?: string;
}

export function MetricChip({ icon, value, tint }: MetricChipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.chip, tint ? { borderColor: `${tint}55` } : null]}>
      <Ionicons name={icon} size={15} color={tint ?? theme.colors.textMuted} />
      <Text style={[styles.text, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 6,
    },
    text: { fontFamily: Fonts.data, fontSize: FontSize.sm, color: theme.colors.textPrimary },
  });
