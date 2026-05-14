import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Colors, FontSize, FontWeight, Radii, Spacing } from '../lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : undefined, style]}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.bg,
    minHeight: 50,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
