import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Fonts, FontSize, FontWeight, Radii, Spacing, Tracking, useTheme, type Theme } from '../lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Ícone opcional renderizado à esquerda do label (ex.: <Ionicons .../>). */
  icon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  icon,
}: ButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const variantStyles = {
    primary: {
      container: { backgroundColor: theme.colors.primary },
      text: { color: theme.colors.onAccent },
      indicator: theme.colors.onAccent,
      glow: true,
    },
    secondary: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.borderStrong },
      text: { color: theme.colors.textPrimary },
      indicator: theme.colors.textPrimary,
      glow: false,
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: theme.colors.primary },
      indicator: theme.colors.primary,
      glow: false,
    },
    danger: {
      container: { backgroundColor: theme.colors.danger },
      text: { color: theme.colors.onAccent },
      indicator: theme.colors.onAccent,
      glow: false,
    },
  } as const;

  const v = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        v.container,
        v.glow && !isDisabled ? theme.shadow.glow : null,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={isDisabled ? theme.colors.textMuted : v.indicator} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, v.text, isDisabled && styles.disabledLabel]}>
            {label.toUpperCase()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Pill-shaped: botões de alta prioridade são totalmente arredondados —
    // distingue elementos clicáveis de cards estáticos.
    base: {
      borderRadius: Radii.full,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    icon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontFamily: Fonts.display,
      fontSize: FontSize.md,
      fontWeight: FontWeight.extrabold,
      letterSpacing: Tracking.wide,
    },
    disabled: {
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: theme.colors.border,
    },
    disabledLabel: {
      color: theme.colors.textMuted,
    },
  });
