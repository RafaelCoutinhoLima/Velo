import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Fonts, FontSize, FontWeight, Radii, Spacing, useTheme, type Theme } from '../lib/theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const confirmBg = confirmVariant === 'danger' ? theme.colors.danger : theme.colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.box, theme.shadow.elevated]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: confirmBg }]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    box: {
      backgroundColor: theme.colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: Spacing.lg,
      width: '100%',
      maxWidth: 360,
    },
    title: {
      ...theme.type.title,
      color: theme.colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    message: {
      ...theme.type.body,
      color: theme.colors.textSecondary,
      marginBottom: Spacing.lg,
    },
    actions: { flexDirection: 'row', gap: Spacing.sm },
    cancelBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.md - 2,
      alignItems: 'center',
    },
    cancelText: {
      fontFamily: Fonts.bodySemiBold,
      fontSize: FontSize.md,
      color: theme.colors.textSecondary,
      fontWeight: FontWeight.semibold,
    },
    confirmBtn: {
      flex: 1,
      borderRadius: Radii.md,
      paddingVertical: Spacing.md - 2,
      alignItems: 'center',
    },
    confirmText: {
      fontFamily: Fonts.display,
      fontSize: FontSize.md,
      color: theme.colors.onAccent,
      fontWeight: FontWeight.extrabold,
    },
  });
