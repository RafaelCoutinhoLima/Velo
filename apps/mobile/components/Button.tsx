import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../lib/theme';

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
    text: { color: Colors.surface },
    indicator: Colors.surface,
    disabled: { backgroundColor: Colors.primaryMuted },
  },
  secondary: {
    container: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary },
    text: { color: Colors.primary },
    indicator: Colors.primary,
    disabled: { backgroundColor: Colors.bg, borderColor: Colors.border },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.primary },
    indicator: Colors.primary,
    disabled: { backgroundColor: 'transparent' },
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    text: { color: Colors.surface },
    indicator: Colors.surface,
    disabled: { backgroundColor: Colors.dangerLight },
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
      style={[styles.base, v.container, isDisabled && v.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={v.indicator} size="small" />
      ) : (
        <Text style={[styles.label, v.text]}>{label}</Text>
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
    fontWeight: FontWeight.bold,
  },
});
