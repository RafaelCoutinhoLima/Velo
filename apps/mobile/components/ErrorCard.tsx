import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../lib/theme';

interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.dangerLight,
      borderRadius: Radii.md,
      padding: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.danger,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    icon: {
      fontSize: FontSize.md,
      lineHeight: 22,
    },
    text: {
      flex: 1,
      fontFamily: Fonts.body,
      fontSize: FontSize.sm,
      color: theme.colors.danger,
      lineHeight: 20,
    },
  });
