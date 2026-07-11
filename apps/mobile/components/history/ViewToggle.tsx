import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radii, Spacing, useTheme, type Theme } from '../../lib/theme';

export type HistoryView = 'list' | 'calendar';

interface ViewToggleProps {
  view: HistoryView;
  onChange: (view: HistoryView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.toggle}>
      {(['list', 'calendar'] as const).map((v) => {
        const active = view === v;
        return (
          <TouchableOpacity
            key={v}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={v === 'list' ? 'list-outline' : 'calendar-outline'}
              size={16}
              color={active ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.text, active && styles.textActive]}>
              {v === 'list' ? 'Lista' : 'Calendário'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: Radii.full,
      padding: 3,
      marginBottom: Spacing.md,
    },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.full,
    },
    btnActive: {
      backgroundColor: theme.colors.surface,
      // No escuro a elevação vira superfície (sem sombra), como o resto do tema.
      ...(theme.name === 'veloDark'
        ? null
        : {
            shadowColor: theme.colors.textPrimary,
            shadowOpacity: 0.12,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }),
    },
    text: { fontFamily: Fonts.bodySemiBold, fontSize: FontSize.sm, color: theme.colors.textSecondary },
    textActive: { color: theme.colors.primary },
  });
