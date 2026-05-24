import { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Radii, Spacing, useTheme, type Theme } from '../lib/theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ style, children, elevated = false, ...props }: CardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[styles.card, elevated ? theme.shadow.elevated : theme.shadow.card, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
