import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : undefined, style]}
        placeholderTextColor={theme.colors.textMuted}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: { marginBottom: Spacing.md },
    label: {
      fontFamily: Fonts.bodyBold,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: Tracking.wide,
      marginBottom: Spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: Radii.md,
      paddingVertical: Spacing.md - 2,
      paddingHorizontal: Spacing.md,
      fontFamily: Fonts.body,
      fontSize: FontSize.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceAlt,
      minHeight: 50,
    },
    inputError: {
      borderColor: theme.colors.danger,
      backgroundColor: theme.colors.dangerLight,
    },
    errorText: {
      fontFamily: Fonts.body,
      fontSize: FontSize.xs,
      color: theme.colors.danger,
      marginTop: Spacing.xs,
    },
  });
