import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, Radii, Shadow, Spacing, Tracking } from '../lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const variantStyles = {
  primary: {
    container: { backgroundColor: Colors.primary },
    text: { color: Colors.onAccent },
    indicator: Colors.onAccent,
    glow: true,
  },
  secondary: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
    text: { color: Colors.primary },
    indicator: Colors.primary,
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
        <Text style={[styles.label, v.text, isDisabled && styles.disabledLabel]}>
          {label.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  label: {
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
