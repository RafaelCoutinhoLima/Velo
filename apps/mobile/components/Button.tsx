import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Colors, Fonts, FontSize, FontWeight, Radii, Shadow, Spacing, Tracking } from '../lib/theme';

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

const variantStyles = {
  primary: {
    container: { backgroundColor: Colors.primary },
    text: { color: Colors.onAccent },
    indicator: Colors.onAccent,
    glow: true,
  },
  secondary: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.borderStrong },
    text: { color: Colors.textPrimary },
    indicator: Colors.textPrimary,
    glow: false,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.primary },
    indicator: Colors.primary,
    glow: false,
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    text: { color: Colors.onAccent },
    indicator: Colors.onAccent,
    glow: false,
  },
} as const;

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
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        v.container,
        v.glow && !isDisabled ? Shadow.glow : null,
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
        <ActivityIndicator color={isDisabled ? Colors.textMuted : v.indicator} size="small" />
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

const styles = StyleSheet.create({
  // Pill-shaped (Stitch "Kinetic Precision": botões de alta prioridade são
  // totalmente arredondados — distingue elementos clicáveis de cards estáticos).
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
    backgroundColor: Colors.surfaceAlt,
    borderColor: Colors.border,
  },
  disabledLabel: {
    color: Colors.textMuted,
  },
});
